#!/usr/bin/env python3
"""Serve a local, hash-locked Ayah timing audition and review session."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import threading
import urllib.request
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlparse

from validate_timing_index import validate

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "tools" / "timing-reviewer" / "index.html"
FONT_PATH = (
    ROOT
    / "node_modules"
    / "@expo-google-fonts"
    / "amiri-quran"
    / "400Regular"
    / "AmiriQuran_400Regular.ttf"
)
RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)$")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_verses(surah: int, expected_count: int) -> list[dict[str, Any]]:
    url = f"https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number={surah}"
    request = urllib.request.Request(url, headers={"User-Agent": "IYF-Quran-Timing-Reviewer/0.1"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = json.load(response)
        verses = [
            {"key": verse["verse_key"], "text": verse["text_uthmani"]}
            for verse in payload["verses"]
        ]
        if len(verses) != expected_count:
            raise ValueError(f"Quran API returned {len(verses)} of {expected_count} Ayahs")
        return verses
    except Exception as error:  # The reviewer remains usable offline with canonical keys.
        print(f"warning: canonical Arabic unavailable: {error}")
        return [
            {"key": f"{surah}:{ayah}", "text": ""}
            for ayah in range(1, expected_count + 1)
        ]


class ReviewState:
    def __init__(self, timing_path: Path, track_index_path: Path, audio_dir: Path):
        self.timing_path = timing_path.resolve()
        self.track_index = json.loads(track_index_path.read_text(encoding="utf-8"))
        self.timing = json.loads(self.timing_path.read_text(encoding="utf-8"))
        validate(self.timing, self.track_index, False)

        tracks = {track["surah"]: track for track in self.track_index["tracks"]}
        self.track = tracks[self.timing["surah"]]
        self.audio_path = (audio_dir / self.track["file"]).resolve()
        if not self.audio_path.is_file():
            raise FileNotFoundError(self.audio_path)
        actual_hash = sha256(self.audio_path)
        if actual_hash != self.track["sha256"]:
            raise ValueError(
                f"Audio hash mismatch: expected {self.track['sha256']}, got {actual_hash}"
            )
        self.verses = fetch_verses(self.track["surah"], self.track["ayahCount"])
        self.lock = threading.Lock()

    def session(self) -> dict[str, Any]:
        with self.lock:
            timing = json.loads(json.dumps(self.timing))
        return {
            "timing": timing,
            "track": self.track,
            "verses": self.verses,
            "audioFile": self.audio_path.name,
        }

    def save(self, timing: dict[str, Any]) -> None:
        validate(timing, self.track_index, False)
        if timing["surah"] != self.timing["surah"]:
            raise ValueError("The Surah cannot change during a review session")
        if timing["audioSha256"] != self.track["sha256"]:
            raise ValueError("The reviewed timing no longer matches the audio track")
        encoded = json.dumps(timing, ensure_ascii=False, indent=2) + "\n"
        temporary = self.timing_path.with_suffix(self.timing_path.suffix + ".tmp")
        temporary.write_text(encoded, encoding="utf-8")
        os.replace(temporary, self.timing_path)
        with self.lock:
            self.timing = timing


class ReviewHandler(BaseHTTPRequestHandler):
    @property
    def review_server(self) -> "ReviewServer":
        return cast("ReviewServer", self.server)

    def log_message(self, format: str, *args: object) -> None:
        print(f"reviewer: {format % args}")

    def send_bytes(
        self,
        payload: bytes,
        content_type: str,
        status: HTTPStatus = HTTPStatus.OK,
        headers: dict[str, str] | None = None,
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def send_json(
        self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK
    ) -> None:
        self.send_bytes(
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            "application/json; charset=utf-8",
            status,
        )

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/":
            self.send_bytes(HTML_PATH.read_bytes(), "text/html; charset=utf-8")
            return
        if path == "/api/session":
            self.send_json(self.review_server.state.session())
            return
        if path == "/font/amiri-quran.ttf":
            self.send_bytes(FONT_PATH.read_bytes(), "font/ttf")
            return
        if path == "/audio":
            self.send_audio()
            return
        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/timing":
            self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 2_000_000:
                raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("Timing payload must be an object")
            self.review_server.state.save(payload)
            self.send_json({"ok": True, "reviewStatus": payload["reviewStatus"]})
        except Exception as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def send_audio(self) -> None:
        audio_path = self.review_server.state.audio_path
        size = audio_path.stat().st_size
        range_header = self.headers.get("Range")
        start = 0
        end = size - 1
        status = HTTPStatus.OK
        headers = {"Accept-Ranges": "bytes"}

        if range_header:
            match = RANGE_RE.fullmatch(range_header.strip())
            if not match:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
            start_text, end_text = match.groups()
            if start_text:
                start = int(start_text)
                end = int(end_text) if end_text else end
            elif end_text:
                length = int(end_text)
                start = max(0, size - length)
            if start >= size or end < start:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                return
            end = min(end, size - 1)
            status = HTTPStatus.PARTIAL_CONTENT
            headers["Content-Range"] = f"bytes {start}-{end}/{size}"

        length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if "Content-Range" in headers:
            self.send_header("Content-Range", headers["Content-Range"])
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command == "HEAD":
            return
        with audio_path.open("rb") as source:
            source.seek(start)
            remaining = length
            while remaining:
                chunk = source.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)


class ReviewServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], state: ReviewState):
        super().__init__(address, ReviewHandler)
        self.state = state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("timing", type=Path)
    parser.add_argument(
        "--track-index", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument(
        "--audio-dir", type=Path, default=Path(".cache/audio/muhammad-al-faqih")
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    state = ReviewState(args.timing, args.track_index, args.audio_dir)
    server = ReviewServer((args.host, args.port), state)
    print(
        f"Timing reviewer: http://{args.host}:{args.port} "
        f"surah={state.track['surah']} ayahs={state.track['ayahCount']} "
        f"sha256={state.track['sha256']}"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
