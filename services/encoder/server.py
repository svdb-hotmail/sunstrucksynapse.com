"""Private, one-job-at-a-time encoder. No database or storage credentials here."""
import hashlib
import json
import math
import os
import subprocess
import tempfile
import threading
import struct
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PROFILE = "sunsyn-mp3-320k-44100-stereo-v1"
MAX_BYTES = 500 * 1024 * 1024
FORMATS = {"audio/wav": "wav", "audio/flac": "flac", "audio/mpeg": "mp3", "audio/mp4": "mov", "audio/ogg": "ogg", "audio/webm": "matroska"}
LOCK = threading.Lock()


def probe(path, input_format):
    result = subprocess.run(["ffprobe", "-v", "error", "-protocol_whitelist", "file,pipe", "-f", input_format, "-show_streams", "-show_format", "-of", "json", str(path)], capture_output=True, timeout=30, check=True)
    return json.loads(result.stdout)


def encode_file(source, target, mime_type, expected_duration_ms):
    before = probe(source, FORMATS[mime_type])
    streams = [s for s in before["streams"] if s.get("codec_type") == "audio"]
    if len(streams) != 1 or any(s.get("codec_type") != "audio" and not s.get("disposition", {}).get("attached_pic") for s in before["streams"]):
        raise ValueError("One audio-only track is required")
    duration = float(before["format"].get("duration", streams[0].get("duration", 0)))
    if not math.isfinite(duration) or not 0 < duration <= 86400:
        raise ValueError("Invalid audio duration")
    if abs(duration * 1000 - expected_duration_ms) > max(1500, expected_duration_ms * 0.01):
        raise ValueError("Source duration does not match the accepted recording")
    subprocess.run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-f", FORMATS[mime_type], "-i", str(source), "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1", "-vn", "-sn", "-dn", "-c:a", "libmp3lame", "-b:a", "320k", "-ar", "44100", "-ac", "2", "-id3v2_version", "3", "-write_xing", "1", "-y", str(target)], capture_output=True, timeout=480, check=True)
    after = probe(target, "mp3")
    stream = next(s for s in after["streams"] if s.get("codec_type") == "audio")
    output_duration = round(float(after["format"]["duration"]) * 1000)
    if stream.get("codec_name") != "mp3" or int(stream.get("sample_rate", 0)) != 44100 or stream.get("channels") != 2 or int(stream.get("bit_rate", 0)) != 320000:
        raise ValueError("Output profile mismatch")
    if abs(output_duration - expected_duration_ms) > max(1500, expected_duration_ms * 0.01):
        raise ValueError("Output duration mismatch")
    size = target.stat().st_size
    if not 0 < size <= MAX_BYTES:
        raise ValueError("Output size out of bounds")
    with target.open("rb") as output:
        output_hash = hashlib.file_digest(output, "sha256").hexdigest()
    return {"profile": PROFILE, "checksumSha256": output_hash, "byteSize": size, "durationMs": output_duration, "sampleRate": 44100, "channels": 2, "bitRate": 320000}


IMAGE_FORMATS = {"image/png": ("png_pipe", "png"), "image/jpeg": ("jpeg_pipe", "mjpeg"), "image/webp": ("webp_pipe", "webp"), "image/avif": ("mov", "av1")}


def validate_artwork(path, mime):
    data = path.read_bytes()
    # Decode errors alone do not catch PNG truncation after the pixel data.
    if mime == "image/png":
        if data[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError("Invalid PNG")
        offset = 8
        ended = False
        while offset < len(data):
            if offset + 12 > len(data):
                raise ValueError("Truncated PNG")
            size = struct.unpack_from(">I", data, offset)[0]
            end = offset + size + 12
            if end > len(data) or zlib.crc32(data[offset+4:end-4]) != struct.unpack_from(">I", data, end-4)[0]:
                raise ValueError("Corrupt PNG")
            kind = data[offset+4:offset+8]
            if kind == b"acTL":
                raise ValueError("Use a still cover")
            offset = end
            if kind == b"IEND":
                if size or offset != len(data):
                    raise ValueError("Invalid PNG ending")
                ended = True
                break
        if not ended:
            raise ValueError("Missing PNG ending")
    elif mime == "image/jpeg" and not data.endswith(b"\xff\xd9"):
        raise ValueError("Truncated JPEG")
    elif mime == "image/webp" and (len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP" or int.from_bytes(data[4:8], "little") + 8 != len(data)):
        raise ValueError("Truncated WebP")
    input_format, codec = IMAGE_FORMATS[mime]
    before = probe(path, input_format)
    streams = before.get("streams", [])
    if len(streams) != 1 or streams[0].get("codec_name") != codec:
        raise ValueError("Invalid cover stream")
    width, height = streams[0].get("width", 0), streams[0].get("height", 0)
    if width != height or not 1400 <= width <= 10000:
        raise ValueError("Invalid cover dimensions")
    # Fully decode pixels in the existing isolated container, never in the
    # memory-limited application Worker. Reject corruption and animation.
    decoded = subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-xerror", "-err_detect", "explode", "-protocol_whitelist", "file,pipe", "-f", input_format, "-i", str(path), "-map", "0:v:0", "-frames:v", "2", "-f", "framemd5", "-"], capture_output=True, timeout=45, check=True)
    frames = [line for line in decoded.stdout.splitlines() if line and not line.startswith(b"#")]
    if len(frames) != 1:
        raise ValueError("Use one still image")
    return {"width": width, "height": height, "mimeType": mime, "checksumSha256": hashlib.sha256(data).hexdigest(), "byteSize": len(data)}


class Handler(BaseHTTPRequestHandler):
    # Never log private headers, media bodies, source paths or ffmpeg stderr.
    def log_message(self, *_):
        pass

    def do_POST(self):
        if self.path not in ("/encode", "/validate-artwork") or not LOCK.acquire(blocking=False):
            self.send_error(409)
            return
        try:
            size = int(self.headers.get("Content-Length", 0))
            mime = self.headers.get("Content-Type", "")
            expected_hash = self.headers.get("X-Source-Checksum", "")
            duration = int(self.headers.get("X-Source-Duration", "0"))
            image = self.path == "/validate-artwork"
            if not 0 < size <= (20 * 1024 * 1024 if image else MAX_BYTES) or mime not in (IMAGE_FORMATS if image else FORMATS) or len(expected_hash) != 64 or any(c not in "0123456789abcdef" for c in expected_hash) or (not image and not 0 < duration <= 86400000):
                raise ValueError("Invalid input")
            self.connection.settimeout(60)
            with tempfile.TemporaryDirectory(prefix="sunsyn-") as directory:
                source, target = Path(directory) / "source.bin", Path(directory) / "stream.mp3"
                digest = hashlib.sha256()
                remaining = size
                with source.open("wb") as handle:
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError("Truncated source")
                        remaining -= len(chunk)
                        digest.update(chunk)
                        handle.write(chunk)
                if digest.hexdigest() != expected_hash:
                    raise ValueError("Source checksum mismatch")
                if image:
                    result = json.dumps(validate_artwork(source, mime), separators=(",", ":")).encode()
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(result)))
                    self.end_headers()
                    self.wfile.write(result)
                    return
                metadata = encode_file(source, target, mime, duration)
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(metadata["byteSize"]))
                self.send_header("X-Encoding-Metadata", json.dumps(metadata, separators=(",", ":")))
                self.end_headers()
                with target.open("rb") as handle:
                    while chunk := handle.read(1024 * 1024):
                        self.wfile.write(chunk)
        except (ValueError, OSError, KeyError, subprocess.SubprocessError):
            self.send_error(422, "Media validation or preparation failed")
        finally:
            LOCK.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
