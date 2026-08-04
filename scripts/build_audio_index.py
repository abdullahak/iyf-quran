#!/usr/bin/env python3
"""Build a hash-locked track index for the Muhammad Al-Faqih corpus.

This indexes complete-Surah recordings only. It does not create or approve Ayah
boundaries; candidate timing files remain a separate reviewed artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def load_ayah_counts(chapters_path: Path) -> dict[int, int]:
    source = chapters_path.read_text(encoding="utf-8")
    pairs = re.findall(
        r'"number"\s*:\s*(\d+).*?"ayahCount"\s*:\s*(\d+)', source, re.DOTALL
    )
    counts = {int(surah): int(count) for surah, count in pairs}
    if sorted(counts) != list(range(1, 115)):
        raise ValueError("Could not derive all 114 canonical Ayah counts from chapters.ts")
    return counts


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def duration_ms(path: Path) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    duration = round(float(result.stdout.strip()) * 1000)
    if duration <= 0:
        raise ValueError(f"Invalid duration for {path}")
    return duration


def inspect_track(
    item: dict[str, Any], audio_dir: Path, ayah_counts: dict[int, int], verify_hashes: bool
) -> dict[str, Any]:
    surah = int(item["surah"])
    path = audio_dir / item["file"]
    if not path.is_file():
        raise FileNotFoundError(path)
    actual_bytes = path.stat().st_size
    if actual_bytes != int(item["bytes"]):
        raise ValueError(f"Byte-size mismatch for Surah {surah}")
    if verify_hashes and sha256(path) != item["sha256"]:
        raise ValueError(f"SHA-256 mismatch for Surah {surah}")

    return {
        "surah": surah,
        "ayahCount": ayah_counts[surah],
        "file": item["file"],
        "bytes": actual_bytes,
        "sha256": item["sha256"],
        "durationMs": duration_ms(path),
        "sourceUrl": item["sourceUrl"],
        "timingStatus": "missing",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--audio-dir", type=Path, default=Path(".cache/audio/muhammad-al-faqih")
    )
    parser.add_argument(
        "--manifest", type=Path, default=Path(".cache/audio/muhammad-al-faqih/manifest.json")
    )
    parser.add_argument(
        "--chapters", type=Path, default=Path("src/data/chapters.ts")
    )
    parser.add_argument(
        "--output", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--verify-hashes", action="store_true")
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    items = manifest.get("items")
    if not isinstance(items, list) or len(items) != 114:
        raise ValueError("Audio manifest must contain exactly 114 items")
    if sorted(int(item["surah"]) for item in items) != list(range(1, 115)):
        raise ValueError("Audio manifest Surah identifiers are incomplete")

    ayah_counts = load_ayah_counts(args.chapters)
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as executor:
        tracks = list(
            executor.map(
                lambda item: inspect_track(
                    item, args.audio_dir, ayah_counts, args.verify_hashes
                ),
                items,
            )
        )
    tracks.sort(key=lambda track: track["surah"])

    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reciter": manifest["reciter"],
        "audioBaseUrl": manifest["audioBaseUrl"],
        "sourceManifest": str(args.manifest),
        "hashesVerified": args.verify_hashes,
        "surahCount": len(tracks),
        "totalBytes": sum(track["bytes"] for track in tracks),
        "totalDurationMs": sum(track["durationMs"] for track in tracks),
        "tracks": tracks,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(args.output)
    print(
        f"indexed={len(tracks)} bytes={payload['totalBytes']} "
        f"durationMs={payload['totalDurationMs']} hashesVerified={args.verify_hashes}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
