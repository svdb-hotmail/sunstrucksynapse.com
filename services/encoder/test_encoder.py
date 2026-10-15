"""Actual ffmpeg verification using generated tones, never artist recordings."""
import hashlib
import http.client
import json
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from server import encode_file, probe, Handler, PROFILE, validate_artwork

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

if __name__ == "__main__":
    unittest.main()
