#!/usr/bin/env python3
"""Validate an Ayah timing index against the exact hash-locked audio track."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, cast

VALID_STATUSES = {"candidate", "reviewed", "verified"}


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def validate(
    timing: dict[str, Any], track_index: dict[str, Any], require_verified: bool
) -> None:
    require(timing.get("schemaVersion") == 1, "Unsupported timing schema")
    surah = timing.get("surah")
    tracks = {track["surah"]: track for track in track_index.get("tracks", [])}
    require(surah in tracks, "Surah is absent from the track index")
    track = tracks[surah]
    require(timing.get("audioSha256") == track["sha256"], "Audio SHA-256 mismatch")
    require(timing.get("durationMs") == track["durationMs"], "Track duration mismatch")

    status = timing.get("reviewStatus")
    require(status in VALID_STATUSES, "Invalid top-level review status")
    points_value = timing.get("ayahs")
    require(isinstance(points_value, list), "ayahs must be a list")
    points = cast(list[dict[str, Any]], points_value)
    require(len(points) == track["ayahCount"], "Timing index has the wrong Ayah count")

    previous_start = -1
    for expected_ayah, point in enumerate(points, start=1):
        require(isinstance(point, dict), f"Ayah {expected_ayah} must be an object")
        require(point.get("ayah") == expected_ayah, f"Missing or reordered Ayah {expected_ayah}")
        require(point.get("key") == f"{surah}:{expected_ayah}", f"Invalid key for Ayah {expected_ayah}")
        start_ms = point.get("startMs")
        if not isinstance(start_ms, int):
            raise ValueError(f"Ayah {expected_ayah} startMs must be an integer")
        require(previous_start < start_ms < track["durationMs"], f"Invalid start for Ayah {expected_ayah}")
        previous_start = start_ms
        confidence = point.get("confidence")
        require(
            isinstance(confidence, (int, float)) and 0 <= confidence <= 1,
            f"Invalid confidence for Ayah {expected_ayah}",
        )
        require(
            point.get("reviewStatus") in VALID_STATUSES,
            f"Invalid review status for Ayah {expected_ayah}",
        )

    prelude = timing.get("prelude")
    if prelude is not None:
        require(isinstance(prelude, dict), "prelude must be an object")
        require(prelude.get("kind") in {"basmala", "silence", "other"}, "Invalid prelude kind")
        require(
            isinstance(prelude.get("startMs"), int)
            and isinstance(prelude.get("endMs"), int)
            and 0 <= prelude["startMs"] < prelude["endMs"] <= points[0]["startMs"],
            "Invalid prelude range",
        )

    if require_verified:
        require(status == "verified", "Top-level timing index is not verified")
        require(
            all(point["reviewStatus"] == "verified" for point in points),
            "At least one Ayah has not been verified",
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("timing", type=Path)
    parser.add_argument(
        "--track-index", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument("--require-verified", action="store_true")
    args = parser.parse_args()

    timing = json.loads(args.timing.read_text(encoding="utf-8"))
    track_index = json.loads(args.track_index.read_text(encoding="utf-8"))
    validate(timing, track_index, args.require_verified)
    print(
        f"valid surah={timing['surah']} ayahs={len(timing['ayahs'])} "
        f"status={timing['reviewStatus']} hash={timing['audioSha256']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
