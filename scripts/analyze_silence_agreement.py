#!/usr/bin/env python3
"""Compare Ayah starts with non-authoritative FFmpeg silence evidence."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

try:
    from scripts.align_with_elevenlabs import (
        sanitized_subprocess_environment,
        validated_track,
    )
except ModuleNotFoundError:
    from align_with_elevenlabs import (  # type: ignore[no-redef]
        sanitized_subprocess_environment,
        validated_track,
    )

SILENCE_START_RE = re.compile(r"silence_start:\s*(-?\d+(?:\.\d+)?)")
SILENCE_END_RE = re.compile(r"silence_end:\s*(-?\d+(?:\.\d+)?)")


def _load_json(path: Path) -> Any:
    def reject_constant(constant: str) -> None:
        raise ValueError(f"Non-finite JSON constant is not allowed: {constant}")

    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def parse_silences(log: str) -> list[tuple[int, int]]:
    intervals: list[tuple[int, int]] = []
    pending_start: int | None = None
    for line in log.splitlines():
        start_match = SILENCE_START_RE.search(line)
        if start_match:
            pending_start = round(float(start_match.group(1)) * 1000)
        end_match = SILENCE_END_RE.search(line)
        if end_match and pending_start is not None:
            end = round(float(end_match.group(1)) * 1000)
            if end > pending_start:
                intervals.append((pending_start, end))
            pending_start = None
    return intervals


def assess_boundaries(
    candidate: dict[str, Any],
    silences: list[tuple[int, int]],
    tolerance_ms: int = 750,
    inside_conflict_ms: int = 100,
) -> dict[str, Any]:
    if not isinstance(candidate, dict):
        raise ValueError("Candidate must be an object")
    if (
        isinstance(tolerance_ms, bool)
        or not isinstance(tolerance_ms, int)
        or tolerance_ms < 0
        or isinstance(inside_conflict_ms, bool)
        or not isinstance(inside_conflict_ms, int)
        or inside_conflict_ms <= 0
    ):
        raise ValueError("Silence tolerances are invalid")
    surah_value = candidate.get("surah")
    if isinstance(surah_value, bool) or not isinstance(surah_value, int):
        raise ValueError("Candidate Surah must be an integer")
    if not 1 <= surah_value <= 114:
        raise ValueError(f"Invalid Surah {surah_value}")
    surah = surah_value
    duration_ms = candidate.get("durationMs")
    if (
        isinstance(duration_ms, bool)
        or not isinstance(duration_ms, int)
        or duration_ms <= 0
    ):
        raise ValueError("Candidate duration must be a positive integer")
    ayahs = candidate.get("ayahs")
    if not isinstance(ayahs, list) or len(ayahs) < 2:
        raise ValueError("Candidate must contain at least two Ayahs")
    previous_start = -1
    for index, ayah in enumerate(ayahs, start=1):
        if not isinstance(ayah, dict):
            raise ValueError(f"Invalid Ayah {surah}:{index}")
        ayah_number = ayah.get("ayah")
        start_ms = ayah.get("startMs")
        if (
            ayah.get("key") != f"{surah}:{index}"
            or isinstance(ayah_number, bool)
            or not isinstance(ayah_number, int)
            or ayah_number != index
            or isinstance(start_ms, bool)
            or not isinstance(start_ms, int)
            or start_ms < 0
            or start_ms >= duration_ms
            or start_ms <= previous_start
        ):
            raise ValueError(
                f"Invalid, reordered, or outside-duration Ayah {surah}:{index}"
            )
        previous_start = start_ms
    for interval in silences:
        if (
            not isinstance(interval, tuple)
            or len(interval) != 2
            or any(isinstance(value, bool) or not isinstance(value, int) for value in interval)
            or interval[0] < 0
            or interval[1] <= interval[0]
        ):
            raise ValueError("Silence intervals must be ordered non-negative integers")
    silence_ends = [end for _, end in silences]
    boundaries: list[dict[str, Any]] = []
    near_count = 0
    inside_count = 0
    for ayah in ayahs[1:]:
        start_ms = cast(int, ayah["startMs"])
        inside_by_ms = max(
            (end - start_ms for start, end in silences if start <= start_ms < end),
            default=0,
        )
        starts_inside = inside_by_ms >= inside_conflict_ms
        nearest_delta: int | None = None
        if silence_ends and not starts_inside:
            closest_end = min(silence_ends, key=lambda end: abs(start_ms - end))
            delta = start_ms - closest_end
            if abs(delta) <= tolerance_ms and (delta >= 0 or inside_by_ms > 0):
                nearest_delta = delta
                near_count += 1
        if starts_inside:
            inside_count += 1
        boundaries.append(
            {
                "key": str(ayah["key"]),
                "startMs": start_ms,
                "nearestSilenceEndDeltaMs": nearest_delta,
                "insideSilenceByMs": inside_by_ms,
                "startsInsideSilence": starts_inside,
            }
        )
    return {
        "surah": surah,
        "testedBoundaryCount": len(boundaries),
        "silenceIntervalCount": len(silences),
        "nearSilenceEndCount": near_count,
        "nearSilenceEndRate": near_count / len(boundaries),
        "insideSilenceCount": inside_count,
        "boundaries": boundaries,
    }


def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidates", type=Path, nargs="+")
    parser.add_argument(
        "--track-index", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument(
        "--audio-dir", type=Path, default=Path(".cache/audio/muhammad-al-faqih")
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(".cache/alignment/elevenlabs/silence-agreement.json"),
    )
    parser.add_argument("--noise", default="-35dB")
    parser.add_argument("--minimum-silence", type=float, default=0.18)
    parser.add_argument("--tolerance-ms", type=int, default=750)
    parser.add_argument("--inside-conflict-ms", type=int, default=100)
    args = parser.parse_args()

    if not re.fullmatch(r"-?\d+(?:\.\d+)?dB", args.noise):
        parser.error("--noise must be a numeric dB value")
    if not math.isfinite(args.minimum_silence) or args.minimum_silence <= 0:
        parser.error("--minimum-silence must be a positive finite number")
    if args.tolerance_ms < 0 or args.inside_conflict_ms <= 0:
        parser.error("Silence tolerances must be non-negative and positive respectively")

    track_index = _load_json(args.track_index)
    if not isinstance(track_index, dict):
        raise ValueError("Track index must be an object")
    results: list[dict[str, Any]] = []
    seen_surahs: set[int] = set()
    for candidate_path in args.candidates:
        candidate = _load_json(candidate_path)
        if not isinstance(candidate, dict):
            raise ValueError(f"Candidate {candidate_path} must be an object")
        surah_value = candidate.get("surah")
        if isinstance(surah_value, bool) or not isinstance(surah_value, int):
            raise ValueError(f"Candidate {candidate_path} has an invalid Surah")
        surah = surah_value
        if surah in seen_surahs:
            raise ValueError(f"Duplicate Surah {surah} in silence inputs")
        seen_surahs.add(surah)
        track, audio_path = validated_track(track_index, surah, args.audio_dir)
        source = candidate.get("source")
        candidate_ayahs = candidate.get("ayahs")
        if (
            candidate.get("reviewStatus") != "candidate"
            or not isinstance(source, dict)
            or source.get("method") != "elevenlabs-forced-alignment"
            or candidate.get("audioSha256") != track.get("sha256")
            or candidate.get("durationMs") != track.get("durationMs")
            or not isinstance(candidate_ayahs, list)
            or len(candidate_ayahs) != track.get("ayahCount")
        ):
            raise ValueError(f"Candidate is not locked to indexed Surah {surah}")
        command = [
            "ffmpeg",
            "-hide_banner",
            "-nostats",
            "-i",
            str(audio_path),
            "-af",
            f"silencedetect=noise={args.noise}:d={args.minimum_silence}",
            "-f",
            "null",
            "-",
        ]
        run = subprocess.run(
            command,
            capture_output=True,
            text=True,
            env=sanitized_subprocess_environment(),
        )
        if run.returncode != 0:
            raise RuntimeError(f"FFmpeg silence detection failed for Surah {surah}")
        results.append(
            assess_boundaries(
                candidate,
                parse_silences(run.stderr),
                tolerance_ms=args.tolerance_ms,
                inside_conflict_ms=args.inside_conflict_ms,
            )
        )

    results.sort(key=lambda result: result["surah"])
    total_boundaries = sum(result["testedBoundaryCount"] for result in results)
    total_near = sum(result["nearSilenceEndCount"] for result in results)
    total_inside = sum(result["insideSilenceCount"] for result in results)
    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "method": "ffmpeg-silencedetect-supporting-signal",
        "configuration": {
            "noise": args.noise,
            "minimumSilenceSeconds": args.minimum_silence,
            "toleranceMs": args.tolerance_ms,
            "insideConflictMs": args.inside_conflict_ms,
        },
        "surahCount": len(results),
        "testedBoundaryCount": total_boundaries,
        "nearSilenceEndCount": total_near,
        "nearSilenceEndRate": total_near / total_boundaries,
        "insideSilenceCount": total_inside,
        "surahs": results,
        "warning": "Silence is supporting evidence only; connected recitation may have no pause.",
    }
    _atomic_write(args.output, report)
    print(
        f"report={args.output} boundaries={total_boundaries} "
        f"nearSilenceEnd={total_near} insideSilence={total_inside}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
