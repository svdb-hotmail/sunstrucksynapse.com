"""Private, one-job-at-a-time encoder. No database or storage credentials here."""
import hashlib
import json
import math
import os
import subprocess
import tempfile
import threading
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


class Handler(BaseHTTPRequestHandler):
    # Never log private headers, media bodies, source paths or ffmpeg stderr.
    def log_message(self, *_):
        pass

    def do_POST(self):
        if self.path != "/encode" or not LOCK.acquire(blocking=False):
            self.send_error(409)
            return
        try:
            size = int(self.headers.get("Content-Length", 0))
            mime = self.headers.get("Content-Type", "")
            expected_hash = self.headers.get("X-Source-Checksum", "")
            duration = int(self.headers.get("X-Source-Duration", "0"))
            if not 0 < size <= MAX_BYTES or mime not in FORMATS or len(expected_hash) != 64 or any(c not in "0123456789abcdef" for c in expected_hash) or not 0 < duration <= 86400000:
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
            self.send_error(422, "Audio preparation failed")
        finally:
            LOCK.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
