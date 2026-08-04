#!/usr/bin/env python3
"""Download Muhammad Al-Faqih's 114-surah MP3Quran corpus.

The corpus is stored outside Git tracking under .cache/. Downloads are
resumable and a local manifest records source URLs, byte sizes, and SHA-256
checksums for repeatable alignment work.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

CATALOG_URL = "https://mp3quran.net/api/v3/reciters?language=eng"
AUDIO_BASE_URL = "https://server16.mp3quran.net/M_Alfaqih/Rewayat-Hafs-A-n-Assem/"
USER_AGENT = "iyf-quran-audio-alignment/1.0 (+https://github.com/abdullahak/iyf-quran)"
_PRINT_LOCK = threading.Lock()


def request(url: str, headers: dict[str, str] | None = None) -> urllib.request.Request:
    merged = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json,audio/mpeg,*/*",
        "Referer": "https://mp3quran.net/eng/mhmd-lfkyh",
        **(headers or {}),
    }
    return urllib.request.Request(url, headers=merged)


def fetch_json(url: str) -> dict[str, Any]:
    with urllib.request.urlopen(request(url), timeout=60) as response:
        return json.load(response)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download_once(url: str, destination: Path) -> None:
    partial = destination.with_suffix(destination.suffix + ".part")
    existing = partial.stat().st_size if partial.exists() else 0
    headers = {"Range": f"bytes={existing}-"} if existing else {}

    try:
        response = urllib.request.urlopen(request(url, headers), timeout=120)
    except urllib.error.HTTPError as error:
        if error.code == 416 and partial.exists():
            partial.replace(destination)
            return
        raise

    with response:
        ranged = response.status == 206
        mode = "ab" if ranged and existing else "wb"
        if existing and not ranged:
            existing = 0
        with partial.open(mode) as handle:
            while chunk := response.read(1024 * 1024):
                handle.write(chunk)

    partial.replace(destination)


def download(url: str, destination: Path, attempts: int = 5) -> None:
    for attempt in range(1, attempts + 1):
        try:
            download_once(url, destination)
            return
        except (ConnectionError, OSError, urllib.error.URLError) as error:
            if attempt == attempts:
                raise
            delay = 2 ** (attempt - 1)
            with _PRINT_LOCK:
                print(
                    f"Retrying {destination.name} in {delay}s "
                    f"after {type(error).__name__} ({attempt}/{attempts})",
                    flush=True,
                )
            time.sleep(delay)


def item_number(item: dict[str, Any]) -> int:
    filename = Path(str(item["url"])).stem
    number = int(filename)
    if not 1 <= number <= 114:
        raise ValueError(f"Unexpected surah number in {item!r}")
    return number


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(".cache/audio/muhammad-al-faqih"),
        help="Destination directory (default: .cache/audio/muhammad-al-faqih)",
    )
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--force", action="store_true", help="Replace existing MP3 files")
    args = parser.parse_args()

    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)

    catalog = fetch_json(CATALOG_URL)
    reciter = next(
        item for item in catalog.get("reciters", []) if item.get("id") == 21184
    )
    moshaf = next(item for item in reciter.get("moshaf", []) if item.get("id") == 10906)
    available = [int(value) for value in str(moshaf["surah_list"]).split(",")]
    category = {
        "title": reciter["name"],
        "items": [
            {
                "title": f"Surah {number}",
                "duration": "unknown",
                "url": f"{number:03d}.mp3",
            }
            for number in available
        ],
    }
    items = sorted(category.get("items", []), key=item_number)
    numbers = [item_number(item) for item in items]
    if numbers != list(range(1, 115)):
        raise RuntimeError(f"Expected exactly surahs 1-114, received {numbers}")

    def fetch_item(item: dict[str, Any]) -> dict[str, Any]:
        number = item_number(item)
        filename = f"{number:03d}.mp3"
        destination = output / filename
        url = urllib.parse.urljoin(AUDIO_BASE_URL, str(item["url"]))
        if args.force:
            destination.unlink(missing_ok=True)
            destination.with_suffix(destination.suffix + ".part").unlink(missing_ok=True)
        if not destination.exists() or destination.stat().st_size == 0:
            download(url, destination)
        record = {
            "surah": number,
            "title": item["title"],
            "declaredDuration": str(item["duration"]),
            "sourceUrl": url,
            "file": filename,
            "bytes": destination.stat().st_size,
            "sha256": sha256(destination),
        }
        with _PRINT_LOCK:
            print(f"[{number:03d}/114] {filename} ({record['bytes']:,} bytes)", flush=True)
        return record

    records: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        futures = [executor.submit(fetch_item, item) for item in items]
        for future in as_completed(futures):
            records.append(future.result())

    records.sort(key=lambda record: record["surah"])
    manifest = {
        "reciter": category.get("title", "Muhammad Al-Faqih"),
        "categorySource": CATALOG_URL,
        "audioBaseUrl": AUDIO_BASE_URL,
        "surahCount": len(records),
        "totalBytes": sum(record["bytes"] for record in records),
        "items": records,
    }
    manifest_path = output / "manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Manifest: {manifest_path}")
    print(f"Downloaded: {manifest['surahCount']} surahs, {manifest['totalBytes']:,} bytes")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Download interrupted; rerun to resume.", file=sys.stderr)
        raise SystemExit(130)
