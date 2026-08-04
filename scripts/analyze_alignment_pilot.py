#!/usr/bin/env python3
"""Rank ElevenLabs pilot anomalies without treating provider loss as confidence."""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import re
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        raise ValueError("Cannot calculate a percentile of an empty list")
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def _metric_summary(values: list[float]) -> dict[str, float]:
    return {
        "min": min(values),
        "p50": percentile(values, 0.5),
        "p95": percentile(values, 0.95),
        "p99": percentile(values, 0.99),
        "max": max(values),
    }


def _finite_float(value: Any, label: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{label} must be a finite number")
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{label} must be a finite number")
    return result


def _integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer")
    return value


def _load_json(path: Path) -> Any:
    def reject_constant(constant: str) -> None:
        raise ValueError(f"Non-finite JSON constant is not allowed: {constant}")

    return json.loads(path.read_text(encoding="utf-8"), parse_constant=reject_constant)


def _identity_maps(
    track_index: dict[str, Any], canonical_records: list[dict[str, Any]]
) -> tuple[dict[int, dict[str, Any]], dict[int, dict[str, Any]]]:
    if (
        track_index.get("schemaVersion") != 1
        or isinstance(track_index.get("schemaVersion"), bool)
        or track_index.get("hashesVerified") is not True
        or not isinstance(track_index.get("tracks"), list)
    ):
        raise ValueError("Independent track index has invalid corpus identity metadata")

    tracks: dict[int, dict[str, Any]] = {}
    for track in track_index["tracks"]:
        if not isinstance(track, dict):
            raise ValueError("Independent track index contains a malformed track")
        surah = _integer(track.get("surah"), "Track Surah")
        ayah_count = _integer(track.get("ayahCount"), "Track Ayah count")
        duration_ms = _integer(track.get("durationMs"), "Track duration")
        audio_sha256 = track.get("sha256")
        if (
            not 1 <= surah <= 114
            or surah in tracks
            or ayah_count <= 0
            or duration_ms <= 0
            or not isinstance(audio_sha256, str)
            or re.fullmatch(r"[0-9a-f]{64}", audio_sha256) is None
        ):
            raise ValueError(f"Invalid independent track corpus identity for Surah {surah}")
        tracks[surah] = track

    canonical: dict[int, dict[str, Any]] = {}
    for record in canonical_records:
        if not isinstance(record, dict):
            raise ValueError("Canonical corpus contains a malformed record")
        surah = _integer(record.get("surah"), "Canonical Surah")
        canonical_sha256 = record.get("canonicalTextSha256")
        verses = record.get("verses")
        if (
            record.get("schemaVersion") != 1
            or isinstance(record.get("schemaVersion"), bool)
            or not 1 <= surah <= 114
            or surah in canonical
            or not isinstance(canonical_sha256, str)
            or re.fullmatch(r"[0-9a-f]{64}", canonical_sha256) is None
            or not isinstance(verses, list)
        ):
            raise ValueError(f"Invalid canonical corpus identity for Surah {surah}")
        track = tracks.get(surah)
        if track is None or len(verses) != track["ayahCount"]:
            raise ValueError(f"Canonical corpus identity does not match track Surah {surah}")
        canonical[surah] = record
    return tracks, canonical


def build_report(
    candidates: list[dict[str, Any]],
    track_index: dict[str, Any],
    canonical_records: list[dict[str, Any]],
    top: int = 50,
    sample: int = 0,
    seed: str = "iyf-quran-alignment-v1",
) -> dict[str, Any]:
    if not candidates:
        raise ValueError("At least one candidate is required")
    if isinstance(top, bool) or not isinstance(top, int) or top < 0:
        raise ValueError("Top count must be a non-negative integer")
    if isinstance(sample, bool) or not isinstance(sample, int) or sample < 0:
        raise ValueError("Sample count must be a non-negative integer")
    if not isinstance(seed, str):
        raise ValueError("Sample seed must be a string")
    tracks, canonical = _identity_maps(track_index, canonical_records)

    points: list[dict[str, Any]] = []
    corpus_identities: list[dict[str, Any]] = []
    surahs: list[int] = []
    seen_surahs: set[int] = set()
    for candidate in candidates:
        if not isinstance(candidate, dict):
            raise ValueError("Pilot inputs must be candidate objects")
        source = candidate.get("source")
        if (
            candidate.get("schemaVersion") != 1
            or isinstance(candidate.get("schemaVersion"), bool)
            or candidate.get("reviewStatus") != "candidate"
            or not isinstance(source, dict)
            or source.get("method") != "elevenlabs-forced-alignment"
        ):
            raise ValueError("Pilot inputs must be ElevenLabs candidate indexes")
        surah = _integer(candidate.get("surah"), "Surah")
        if not 1 <= surah <= 114:
            raise ValueError(f"Invalid Surah {surah}")
        if surah in seen_surahs:
            raise ValueError(f"Duplicate Surah {surah} in report inputs")
        seen_surahs.add(surah)
        surahs.append(surah)
        ayahs = candidate.get("ayahs")
        if not isinstance(ayahs, list) or not ayahs:
            raise ValueError(f"Surah {surah} has no candidate Ayahs")
        duration_ms = _integer(candidate.get("durationMs"), "Track duration")
        if duration_ms <= 0:
            raise ValueError(f"Surah {surah} duration must be a positive integer")
        track = tracks.get(surah)
        canonical_record = canonical.get(surah)
        if (
            track is None
            or canonical_record is None
            or candidate.get("audioSha256") != track.get("sha256")
            or duration_ms != track.get("durationMs")
            or len(ayahs) != track.get("ayahCount")
            or source.get("canonicalTextSha256")
            != canonical_record.get("canonicalTextSha256")
        ):
            raise ValueError(f"Candidate corpus identity does not match Surah {surah}")
        corpus_identities.append(
            {
                "surah": surah,
                "audioSha256": track["sha256"],
                "canonicalTextSha256": canonical_record["canonicalTextSha256"],
                "durationMs": track["durationMs"],
                "ayahCount": track["ayahCount"],
            }
        )
        if any(not isinstance(ayah, dict) for ayah in ayahs):
            raise ValueError(f"Surah {surah} contains a malformed Ayah")
        for index, ayah in enumerate(ayahs):
            expected_ayah = index + 1
            ayah_number = _integer(ayah.get("ayah"), "Ayah number")
            if (
                ayah.get("key") != f"{surah}:{expected_ayah}"
                or ayah_number != expected_ayah
            ):
                raise ValueError(f"Invalid or reordered Ayah {surah}:{expected_ayah}")
            next_start = (
                _integer(ayahs[index + 1].get("startMs"), "Ayah start")
                if index + 1 < len(ayahs)
                else duration_ms
            )
            start_ms = _integer(ayah.get("startMs"), "Ayah start")
            word_count = _integer(ayah.get("wordCount"), "Word count")
            collapsed_count = _integer(
                ayah.get("collapsedWordCount", 0), "Collapsed word count"
            )
            if start_ms < 0 or next_start <= start_ms or word_count <= 0:
                raise ValueError(f"Invalid duration or word count for {ayah.get('key')}")
            if collapsed_count < 0 or collapsed_count > word_count:
                raise ValueError(f"Invalid collapsed word count for {ayah.get('key')}")
            alignment_loss = _finite_float(
                ayah.get("alignmentLoss"), "Alignment loss"
            )
            max_word_loss = _finite_float(
                ayah.get("maxWordLoss"), "Maximum word loss"
            )
            if alignment_loss < 0 or max_word_loss < 0:
                raise ValueError(f"Loss metrics must be non-negative for {ayah.get('key')}")
            points.append(
                {
                    "key": str(ayah["key"]),
                    "surah": surah,
                    "ayah": expected_ayah,
                    "alignmentLoss": alignment_loss,
                    "maxWordLoss": max_word_loss,
                    "durationMs": next_start - start_ms,
                    "wordCount": word_count,
                    "collapsedWordCount": collapsed_count,
                    "durationPerWordMs": (next_start - start_ms) / word_count,
                }
            )

    points.sort(key=lambda point: (point["surah"], point["ayah"]))
    surahs.sort()
    corpus_identities.sort(key=lambda identity: identity["surah"])
    losses = [point["alignmentLoss"] for point in points]
    max_losses = [point["maxWordLoss"] for point in points]
    cadences = [point["durationPerWordMs"] for point in points]
    loss_p95 = percentile(losses, 0.95)
    max_loss_p95 = percentile(max_losses, 0.95)
    cadence_p01 = percentile(cadences, 0.01)
    cadence_p99 = percentile(cadences, 0.99)
    loss_scale = max(median(losses), 1e-9)
    max_loss_scale = max(median(max_losses), 1e-9)
    cadence_scale = max(median(cadences), 1e-9)

    anomalies: list[dict[str, Any]] = []
    for point in points:
        reasons: list[str] = []
        if max(losses) > min(losses) and point["alignmentLoss"] >= loss_p95:
            reasons.append("highAlignmentLoss")
        if max(max_losses) > min(max_losses) and point["maxWordLoss"] >= max_loss_p95:
            reasons.append("highMaxWordLoss")
        if max(cadences) > min(cadences):
            if point["durationPerWordMs"] <= cadence_p01:
                reasons.append("shortDurationPerWord")
            if point["durationPerWordMs"] >= cadence_p99:
                reasons.append("longDurationPerWord")
        if point["collapsedWordCount"]:
            reasons.append("collapsedProviderWords")
        if not reasons:
            continue
        score = (
            point["alignmentLoss"] / loss_scale
            + point["maxWordLoss"] / max_loss_scale
            + abs(math.log(max(point["durationPerWordMs"] / cadence_scale, 1e-9)))
            + (
                5 + min(point["collapsedWordCount"], 10)
                if point["collapsedWordCount"]
                else 0
            )
        )
        anomalies.append({**point, "anomalyScore": score, "reasons": reasons})

    anomalies.sort(
        key=lambda anomaly: (
            -anomaly["anomalyScore"],
            anomaly["surah"],
            anomaly["ayah"],
        )
    )
    sample_size = min(max(0, sample), len(points))
    random_sample = random.Random(seed).sample(points, sample_size)
    random_sample.sort(key=lambda point: (point["surah"], point["ayah"]))
    return {
        "schemaVersion": 1,
        "calibrationStatus": "uncalibrated",
        "surahs": surahs,
        "surahCount": len(surahs),
        "ayahCount": len(points),
        "corpusIdentities": corpus_identities,
        "metrics": {
            "alignmentLoss": _metric_summary(losses),
            "maxWordLoss": _metric_summary(max_losses),
            "durationPerWordMs": _metric_summary(cadences),
        },
        "anomalyCount": len(anomalies),
        "collapsedProviderWordCount": sum(
            point["collapsedWordCount"] for point in points
        ),
        "topAnomalies": anomalies[: max(0, top)],
        "randomSampleSeed": seed,
        "randomSample": random_sample,
        "warnings": [
            "ElevenLabs loss is ranked within this pilot and is not a calibrated probability.",
            "Acoustic agreement, structural validation, and representative review remain required.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("candidates", type=Path, nargs="+")
    parser.add_argument(
        "--track-index", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument(
        "--canonical-dir", type=Path, default=Path(".cache/alignment/canonical")
    )
    parser.add_argument(
        "--output", type=Path, default=Path(".cache/alignment/elevenlabs/pilot-report.json")
    )
    parser.add_argument("--top", type=int, default=50)
    parser.add_argument("--sample", type=int, default=0)
    parser.add_argument("--seed", default="iyf-quran-alignment-v1")
    args = parser.parse_args()

    candidates = [_load_json(path) for path in args.candidates]
    track_index = _load_json(args.track_index)
    if not isinstance(track_index, dict):
        raise ValueError("Independent track index must be an object")
    canonical_records = [
        record
        for path in sorted(args.canonical_dir.glob("*.json"))
        if isinstance((record := _load_json(path)), dict)
    ]
    report = build_report(
        candidates,
        track_index,
        canonical_records,
        top=args.top,
        sample=args.sample,
        seed=args.seed,
    )
    report["generatedAt"] = datetime.now(timezone.utc).isoformat()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, args.output)
    print(
        f"report={args.output} surahs={report['surahCount']} "
        f"ayahs={report['ayahCount']} anomalies={report['anomalyCount']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
