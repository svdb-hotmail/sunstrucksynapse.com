"""Actual ffmpeg verification using generated tones, never artist recordings."""
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import MagicMock, patch
from http.server import ThreadingHTTPServer
from server import encode_file, probe, Handler, PROFILE, validate_artwork, extract_artwork_palette, palette_from_rgba, _contrast

class EncoderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.source = Path(self.tmp.name) / "tone.wav"
        self.output = Path(self.tmp.name) / "stream.mp3"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-ac", "1", "-metadata", "title=private-source-title", str(self.source)], check=True)

    def test_full_image_decode_and_complete_structure(self):
        for ext, mime in [("png", "image/png"), ("jpg", "image/jpeg"), ("webp", "image/webp"), ("avif", "image/avif")]:
            image = Path(self.tmp.name) / ("cover." + ext)
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=blue:size=1400x1400", "-frames:v", "1", "-threads", "1", str(image)], check=True)
            valid = image.read_bytes()
            self.assertEqual(validate_artwork(image, mime)["width"], 1400)
            image.write_bytes(valid[:33])
            with self.assertRaises((ValueError, subprocess.SubprocessError)):
                validate_artwork(image, mime)
            image.write_bytes(valid[:-12])
            with self.assertRaises((ValueError, subprocess.SubprocessError)):
                validate_artwork(image, mime)

    def test_real_palette_for_all_supported_mime_types(self):
        for ext, mime in [("png", "image/png"), ("jpg", "image/jpeg"), ("webp", "image/webp"), ("avif", "image/avif")]:
            image = Path(self.tmp.name) / ("sample." + ext)
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=yellow:size=96x64", "-frames:v", "1", "-threads", "1", str(image)], check=True)
            result = extract_artwork_palette(image, mime)
            self.assertEqual(result, extract_artwork_palette(image, mime))
            self.assertEqual(result["version"], 1)
            self.assertEqual((result["width"], result["height"]), (96, 64))
            self.assertEqual(result["mimeType"], mime)
            self.assertEqual(result["checksumSha256"], hashlib.sha256(image.read_bytes()).hexdigest())
            self.assertEqual(result["byteSize"], image.stat().st_size)
            colors = result["colors"]
            self.assertEqual(len(colors), 7)
            def rgb(key):
                return [int(colors[key][offset:offset+2], 16) for offset in (1, 3, 5)]
            for ink, surface in [("inkLight", "paperLight"), ("inkLight", "surfaceLight"), ("inkDark", "paperDark"), ("inkDark", "surfaceDark")]:
                self.assertGreaterEqual(_contrast(rgb(ink), rgb(surface)), 4.5)
            self.assertGreaterEqual(_contrast([255, 255, 255], rgb("accent")), 4.5)
            wrong_mime = "image/jpeg" if mime != "image/jpeg" else "image/png"
            with self.assertRaises((ValueError, subprocess.SubprocessError)):
                extract_artwork_palette(image, wrong_mime)

    def test_palette_alpha_and_ties_are_deterministic(self):
        neutral = bytes([128, 128, 128, 255]) * (48 * 48)
        self.assertEqual(palette_from_rgba(bytes([255, 0, 0, 0]) * (48 * 48)), palette_from_rgba(neutral))
        first = bytes([0, 0, 255, 255]) * (48 * 24)
        second = bytes([255, 0, 0, 255]) * (48 * 24)
        self.assertEqual(palette_from_rgba(first + second), palette_from_rgba(second + first))
        with self.assertRaises(ValueError):
            palette_from_rgba(b"short")

    def test_solid_black_and_white_samples_keep_both_themes_readable(self):
        outputs = []
        for channel in (0, 255):
            pixels = bytes([channel, channel, channel, 255]) * (48 * 48)
            colors = palette_from_rgba(pixels)
            self.assertEqual(colors, palette_from_rgba(pixels))
            outputs.append(colors)
            def rgb(key):
                return [int(colors[key][offset:offset+2], 16) for offset in (1, 3, 5)]
            for ink, surface in [("inkLight", "paperLight"), ("inkLight", "surfaceLight"), ("inkDark", "paperDark"), ("inkDark", "surfaceDark")]:
                self.assertGreaterEqual(_contrast(rgb(ink), rgb(surface)), 4.5)
            self.assertGreaterEqual(_contrast([255, 255, 255], rgb("accent")), 4.5)
        self.assertNotEqual(outputs[0], outputs[1])

    def test_palette_http_verifies_source_hash(self):
        image = Path(self.tmp.name) / "http-cover.png"
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=blue:size=32x32", "-frames:v", "1", "-threads", "1", str(image)], check=True)
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        body = image.read_bytes()
        for checksum, status in [("0" * 64, 422), (hashlib.sha256(body).hexdigest(), 200)]:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=60)
            connection.request("POST", "/artwork-palette", body, {"Content-Type": "image/png", "X-Source-Checksum": checksum})
            response = connection.getresponse()
            data = response.read()
            self.assertEqual(response.status, status)
            if status == 200:
                result = json.loads(data)
                self.assertEqual(result["byteSize"], len(body))
                self.assertEqual(result["version"], 1)
                self.assertEqual(len(result["colors"]), 7)
            connection.close()

    def test_real_lossless_encode_has_uniform_profile_and_preserves_source(self):
        original = self.source.read_bytes()
        result = encode_file(self.source, self.output, "audio/wav", 2000)
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual(result["profile"], PROFILE)
        self.assertEqual(result["checksumSha256"], hashlib.sha256(self.output.read_bytes()).hexdigest())
        self.assertEqual((result["sampleRate"], result["channels"], result["bitRate"]), (44100, 2, 320000))
        self.assertEqual(len(probe(self.output, "mp3")["streams"]), 1)
        self.assertNotIn("title", probe(self.output, "mp3")["format"].get("tags", {}))

    def test_rejects_wrong_format_and_wrong_accepted_duration(self):
        with self.assertRaises((ValueError, subprocess.SubprocessError)):
            encode_file(self.source, self.output, "audio/flac", 2000)
        with self.assertRaises(ValueError):
            encode_file(self.source, self.output, "audio/wav", 180000)
        self.assertFalse(self.output.exists())

    def test_http_verifies_exact_source_checksum_before_returning_derivative(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        source = self.source.read_bytes()
        for checksum, status in [("0" * 64, 422), (hashlib.sha256(source).hexdigest(), 200)]:
            connection = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=30)
            connection.request("POST", "/encode", source, {"Content-Type": "audio/wav", "X-Source-Checksum": checksum, "X-Source-Duration": "2000"})
            response = connection.getresponse()
            body = response.read()
            self.assertEqual(response.status, status)
            if status == 200:
                metadata = json.loads(response.getheader("X-Encoding-Metadata"))
                self.assertEqual(metadata["checksumSha256"], hashlib.sha256(body).hexdigest())
                self.assertEqual(metadata["byteSize"], len(body))
            connection.close()


class ArtworkPaletteBoundaryTests(unittest.TestCase):
    """Reject unsafe sources without allocating or decoding large fixtures."""

    def test_rejects_input_over_twenty_mib_before_probe_or_decode(self):
        source = MagicMock(spec=Path)
        oversized = MagicMock()
        oversized.__len__.return_value = 20 * 1024 * 1024 + 1
        source.read_bytes.return_value = oversized
        with patch("server.probe") as image_probe, patch("server.subprocess.run") as decode:
            with self.assertRaisesRegex(ValueError, "Image size out of bounds"):
                extract_artwork_palette(source, "image/jpeg")
            image_probe.assert_not_called()
            decode.assert_not_called()

    def test_rejects_over_forty_megapixels_before_decode(self):
        source = MagicMock(spec=Path)
        source.read_bytes.return_value = b"\xff\xd8\xff\xd9"
        metadata = {"streams": [{"codec_name": "mjpeg", "width": 8000, "height": 5001}]}
        with patch("server.probe", return_value=metadata) as image_probe, patch("server.subprocess.run") as decode:
            with self.assertRaisesRegex(ValueError, "Invalid image dimensions"):
                extract_artwork_palette(source, "image/jpeg")
            image_probe.assert_called_once_with(source, "jpeg_pipe")
            decode.assert_not_called()

    def test_rejects_multiple_decoded_frames_before_sampling(self):
        source = MagicMock(spec=Path)
        source.read_bytes.return_value = b"\xff\xd8\xff\xd9"
        metadata = {"streams": [{"codec_name": "mjpeg", "width": 48, "height": 48}]}
        decoded = subprocess.CompletedProcess([], 0, stdout=b"# frame checksums\n0, first-frame\n0, second-frame\n")
        with patch("server.probe", return_value=metadata), patch("server.subprocess.run", return_value=decoded) as decode:
            with self.assertRaisesRegex(ValueError, "Use one still image"):
                extract_artwork_palette(source, "image/jpeg")
            # Only the bounded full-image validation runs; palette sampling must
            # never be reached for an animated source.
            decode.assert_called_once()
            arguments = decode.call_args.args[0]
            self.assertEqual(arguments[arguments.index("-frames:v") + 1], "2")
            self.assertIn("framemd5", arguments)
            self.assertEqual(decode.call_args.kwargs["timeout"], 45)

if __name__ == "__main__":
    unittest.main()
