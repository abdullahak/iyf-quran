#!/usr/bin/env python3
"""Generate hash-locked Ayah timing candidates with ElevenLabs Forced Alignment.

The provider is given a normalized alignment-only representation of canonical
Quran text. Raw responses and candidates stay under .cache/ and never publish
themselves into the application.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import math
import os
import re
import subprocess
import unicodedata
import urllib.request
from collections.abc import Mapping
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from typing import Any, Callable, Iterator, Literal, cast

BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ"
ELEVENLABS_URL = "https://api.elevenlabs.io/v1/forced-alignment"
ARABIC_LETTER_RE = re.compile(r"[^\u0621-\u063a\u0641-\u064a]+")
LETTER_TRANSLATION = str.maketrans(
    {
        "آ": "ا",
        "أ": "ا",
        "إ": "ا",
        "ٱ": "ا",
        "ؤ": "و",
        "ئ": "ي",
        "ى": "ي",
    }
)

ROOT = Path(__file__).resolve().parents[1]


def sanitized_subprocess_environment(
    environ: Mapping[str, str] | None = None,
) -> dict[str, str]:
    environment = dict(os.environ if environ is None else environ)
    environment.pop("ELEVENLABS_API_KEY", None)
    return environment


def _strict_json_loads(value: str) -> Any:
    def reject_constant(constant: str) -> None:
        raise ValueError(f"Non-finite JSON constant is not allowed: {constant}")

    return json.loads(value, parse_constant=reject_constant)


@contextmanager
def _exclusive_raw_charge_lock(raw_path: Path) -> Iterator[None]:
    """Fail fast when another process is already deciding a paid Surah request."""
    lock_path = raw_path.with_suffix(raw_path.suffix + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
    descriptor = os.open(lock_path, flags, 0o600)
    with os.fdopen(descriptor, "r+") as lock_handle:
        try:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise RuntimeError(f"Surah raw response is already processing: {raw_path}") from error
        try:
            yield
        finally:
            fcntl.flock(lock_handle.fileno(), fcntl.LOCK_UN)


def _raw_response_mode(
    raw_path: Path, *, reuse_raw: bool, force: bool
) -> Literal["reuse", "request"]:
    if raw_path.is_symlink() or (raw_path.exists() and not raw_path.is_file()):
        raise ValueError(f"Raw response path must be a regular file, not a symlink: {raw_path}")
    if reuse_raw:
        if not raw_path.is_file():
            raise FileNotFoundError(
                f"Cannot reuse missing raw response: {raw_path}; remove --reuse-raw to request it"
            )
        return "reuse"
    request_state_path = _raw_request_state_path(raw_path)
    if request_state_path.exists() and not force:
        raise RuntimeError(
            f"Prior request outcome is uncertain for {raw_path}; inspect the provider "
            "and cached state before explicitly using --force"
        )
    if raw_path.exists() and not force:
        raise FileExistsError(
            f"Refusing to charge for an existing Surah: {raw_path}; "
            "use --reuse-raw or --force"
        )
    return "request"


def _raw_request_state_path(raw_path: Path) -> Path:
    return raw_path.with_suffix(raw_path.suffix + ".request-state.json")


def load_api_key() -> str:
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key and os.uname().sysname == "Darwin":
        result = subprocess.run(
            [
                "security",
                "find-generic-password",
                "-a",
                os.environ.get("USER", ""),
                "-s",
                "IYF_ELEVENLABS_API_KEY",
                "-w",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        api_key = result.stdout.strip()
    if not re.fullmatch(r"sk_[A-Za-z0-9]+", api_key):
        raise ValueError(
            "ElevenLabs key unavailable; set ELEVENLABS_API_KEY or save the Keychain item"
        )
    return api_key


def normalize_alignment_text(text: str) -> str:
    """Create a simple Arabic representation without mutating source Quran text."""
    decomposed = unicodedata.normalize("NFKD", text).translate(LETTER_TRANSLATION)
    without_marks = "".join(
        character for character in decomposed if unicodedata.category(character) != "Mn"
    )
    without_tatweel = without_marks.replace("ـ", "")
    return " ".join(ARABIC_LETTER_RE.sub(" ", without_tatweel).split())


def _token_rows(text: str, kind: str, ayah: int | None) -> list[dict[str, Any]]:
    normalized = normalize_alignment_text(text)
    if not normalized:
        raise ValueError("Canonical text became empty after alignment normalization")
    return [
        {"text": token, "kind": kind, "ayah": ayah}
        for token in normalized.split()
    ]


def build_alignment_plan(surah: int, verses: list[dict[str, Any]]) -> dict[str, Any]:
    if not 1 <= surah <= 114:
        raise ValueError("surah must be between 1 and 114")
    if not verses:
        raise ValueError("Canonical verses cannot be empty")

    tokens: list[dict[str, Any]] = []
    if surah not in {1, 9}:
        tokens.extend(_token_rows(BASMALA, "prelude", None))

    for expected_ayah, verse in enumerate(verses, start=1):
        if verse.get("key") != f"{surah}:{expected_ayah}":
            raise ValueError(f"Missing or reordered canonical Ayah {surah}:{expected_ayah}")
        text = verse.get("text")
        if not isinstance(text, str):
            raise ValueError(f"Canonical Ayah {surah}:{expected_ayah} has no text")
        tokens.extend(_token_rows(text, "ayah", expected_ayah))

    return {
        "surah": surah,
        "text": " ".join(token["text"] for token in tokens),
        "tokens": tokens,
        "ayahCount": len(verses),
    }


def canonical_verses_from_payload(
    surah: int, expected_count: int, payload: dict[str, Any]
) -> list[dict[str, str]]:
    raw_verses = payload.get("verses")
    if not isinstance(raw_verses, list) or len(raw_verses) != expected_count:
        actual_count = len(raw_verses) if isinstance(raw_verses, list) else 0
        raise ValueError(
            f"Canonical source returned {actual_count} Ayahs; expected {expected_count}"
        )
    verses: list[dict[str, str]] = []
    for ayah, raw_verse in enumerate(raw_verses, start=1):
        if not isinstance(raw_verse, dict):
            raise ValueError(f"Canonical Ayah {surah}:{ayah} is not an object")
        key = raw_verse.get("verse_key")
        text = raw_verse.get("text_uthmani")
        if key != f"{surah}:{ayah}" or not isinstance(text, str) or not text.strip():
            raise ValueError(f"Invalid canonical Ayah {surah}:{ayah}")
        verses.append({"key": cast(str, key), "text": text})
    return verses


def curl_alignment_command(
    *,
    audio_path: str,
    text_path: str,
    api_key: str,
    upload_name: str | None = None,
) -> tuple[list[str], str]:
    if not re.fullmatch(r"sk_[A-Za-z0-9]+", api_key):
        raise ValueError("The ElevenLabs API key has an unexpected format")
    file_form = f"file=@{audio_path}"
    if upload_name is not None:
        if not re.fullmatch(r"\d{3}\.mp3", upload_name):
            raise ValueError("The upload file name must be a canonical Surah MP3 name")
        file_form += f";filename={upload_name}"
    command = [
        "curl",
        "--disable",
        "--config",
        "-",
        "--silent",
        "--show-error",
        "--fail-with-body",
        "--request",
        "POST",
        ELEVENLABS_URL,
        "--form",
        file_form,
        "--form",
        f"text=<{text_path}",
    ]
    # Send the secret through curl's stdin config rather than exposing it in
    # process arguments, temporary files, logs, or generated artifacts.
    return command, f'header = "xi-api-key: {api_key}"\n'


def _probe_decoded_duration_ms(audio_path: Path) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
        env=sanitized_subprocess_environment(),
    )
    if result.returncode != 0:
        raise ValueError("Unable to probe decoded audio duration")
    try:
        seconds = float(result.stdout.strip())
    except ValueError as error:
        raise ValueError("FFprobe returned an invalid duration") from error
    if not math.isfinite(seconds) or seconds <= 0:
        raise ValueError("FFprobe returned a non-positive duration")
    return round(seconds * 1000)


def validated_track(
    track_index: dict[str, Any],
    surah: int,
    audio_dir: Path,
    duration_probe: Callable[[Path], int] | None = None,
) -> tuple[dict[str, Any], Path]:
    if isinstance(surah, bool) or not isinstance(surah, int) or not 1 <= surah <= 114:
        raise ValueError("Requested Surah must be an integer between 1 and 114")
    if track_index.get("hashesVerified") is not True:
        raise ValueError("The track index is not hash-verified")
    raw_tracks = track_index.get("tracks")
    if not isinstance(raw_tracks, list):
        raise ValueError("Track index has no tracks list")
    matches = [
        track
        for track in raw_tracks
        if isinstance(track, dict)
        and isinstance(track.get("surah"), int)
        and not isinstance(track.get("surah"), bool)
        and track.get("surah") == surah
    ]
    if len(matches) != 1:
        raise ValueError(f"Surah {surah} must appear exactly one time in the track index")
    track = matches[0]
    file_name = track.get("file")
    if file_name != f"{surah:03d}.mp3":
        raise ValueError(f"Surah {surah} has an invalid audio file name")
    file_name = cast(str, file_name)
    expected_sha256 = track.get("sha256")
    expected_duration_ms = track.get("durationMs")
    expected_ayah_count = track.get("ayahCount")
    if not isinstance(expected_sha256, str) or not re.fullmatch(
        r"[0-9a-f]{64}", expected_sha256
    ):
        raise ValueError(f"Surah {surah} has an invalid SHA-256")
    if (
        isinstance(expected_duration_ms, bool)
        or not isinstance(expected_duration_ms, int)
        or expected_duration_ms <= 0
    ):
        raise ValueError(f"Surah {surah} has an invalid decoded duration")
    if (
        isinstance(expected_ayah_count, bool)
        or not isinstance(expected_ayah_count, int)
        or expected_ayah_count <= 0
    ):
        raise ValueError(f"Surah {surah} has an invalid Ayah count")
    audio_root = audio_dir.resolve(strict=True)
    unresolved_path = audio_root / file_name
    if unresolved_path.is_symlink():
        raise ValueError(f"Audio path for Surah {surah} must not be a symlink")
    audio_path = unresolved_path.resolve(strict=True)
    if audio_path.parent != audio_root:
        raise ValueError(f"Audio path for Surah {surah} escapes the audio directory")
    if not audio_path.is_file():
        raise FileNotFoundError(audio_path)
    digest = hashlib.sha256()
    with audio_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected_sha256:
        raise ValueError(f"Audio SHA-256 mismatch for Surah {surah}")
    decoded_duration_ms = (duration_probe or _probe_decoded_duration_ms)(audio_path)
    if decoded_duration_ms != expected_duration_ms:
        raise ValueError(
            f"Decoded duration mismatch for Surah {surah}: "
            f"expected {expected_duration_ms}, got {decoded_duration_ms}"
        )
    return track, audio_path


def _finite_number(value: Any, label: str) -> float:
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
    ):
        raise ValueError(f"{label} must be a finite number")
    return float(value)


def build_candidate(
    *,
    surah: int,
    track: dict[str, Any],
    plan: dict[str, Any],
    response: dict[str, Any],
    canonical_sha256: str,
    raw_artifact: str,
    generated_at: str,
) -> dict[str, Any]:
    raw_words = response.get("words")
    if not isinstance(raw_words, list):
        raise ValueError("ElevenLabs response has no words list")
    words: list[dict[str, Any]] = []
    for index, word in enumerate(raw_words, start=1):
        if not isinstance(word, dict):
            raise ValueError(f"ElevenLabs word {index} must be an object")
        text = word.get("text")
        if not isinstance(text, str):
            raise ValueError(f"ElevenLabs word {index} has no text")
        if text.isspace():
            continue
        if not normalize_alignment_text(text):
            raise ValueError(
                f"ElevenLabs word {index} is a non-whitespace record without Arabic text"
            )
        words.append(word)
    tokens = plan["tokens"]
    if len(words) != len(tokens):
        raise ValueError("ElevenLabs word sequence length does not match supplied text")

    duration_seconds = track["durationMs"] / 1000
    previous_start = -1.0
    previous_end = -1.0
    aligned: list[dict[str, Any]] = []
    for index, (token, word) in enumerate(zip(tokens, words, strict=True), start=1):
        returned_text = normalize_alignment_text(str(word.get("text", "")))
        if returned_text != token["text"]:
            raise ValueError(
                f"ElevenLabs word sequence differs at token {index}: "
                f"expected {token['text']!r}, got {returned_text!r}"
            )
        start = _finite_number(word.get("start"), f"Word {index} start")
        end = _finite_number(word.get("end"), f"Word {index} end")
        loss = _finite_number(word.get("loss"), f"Word {index} loss")
        if not 0 <= start < end <= duration_seconds:
            raise ValueError(f"ElevenLabs word {index} is outside the track duration")
        if start < previous_start:
            raise ValueError("ElevenLabs word timestamps are not monotonic")
        if start < previous_end - 0.002:
            raise ValueError("ElevenLabs word timestamps overlap")
        if loss < 0:
            raise ValueError(f"ElevenLabs word {index} has negative loss")
        previous_start = start
        previous_end = max(previous_end, end)
        aligned.append({**token, "start": start, "end": end, "loss": loss})

    overall_loss = _finite_number(response.get("loss"), "Overall loss")
    if overall_loss < 0:
        raise ValueError("Overall loss cannot be negative")
    if plan["ayahCount"] != track["ayahCount"]:
        raise ValueError("Canonical and track Ayah counts differ")

    ayahs: list[dict[str, Any]] = []
    for ayah in range(1, track["ayahCount"] + 1):
        ayah_words = [word for word in aligned if word["ayah"] == ayah]
        if not ayah_words:
            raise ValueError(f"Ayah {surah}:{ayah} has no aligned words")
        word_durations_ms = [
            round((word["end"] - word["start"]) * 1000, 3)
            for word in ayah_words
        ]
        ayahs.append(
            {
                "key": f"{surah}:{ayah}",
                "ayah": ayah,
                "startMs": round(ayah_words[0]["start"] * 1000),
                # ElevenLabs loss is not a calibrated probability. Keep candidate
                # confidence at zero until pilot thresholds are established.
                "confidence": 0,
                "reviewStatus": "candidate",
                "alignmentLoss": round(mean(word["loss"] for word in ayah_words), 6),
                "maxWordLoss": round(max(word["loss"] for word in ayah_words), 6),
                "wordCount": len(ayah_words),
                "minWordDurationMs": round(min(word_durations_ms), 3),
                "collapsedWordCount": sum(
                    duration <= 10 for duration in word_durations_ms
                ),
            }
        )

    prelude_words = [word for word in aligned if word["kind"] == "prelude"]
    prelude: dict[str, Any] | None = None
    if prelude_words:
        prelude = {
            "kind": "basmala",
            "startMs": round(prelude_words[0]["start"] * 1000),
            "endMs": round(prelude_words[-1]["end"] * 1000),
        }
    first_aligned_start_ms = (
        prelude["startMs"] if prelude is not None else ayahs[0]["startMs"]
    )

    candidate: dict[str, Any] = {
        "schemaVersion": 1,
        "surah": surah,
        "audioSha256": track["sha256"],
        "durationMs": track["durationMs"],
        "source": {
            "method": "elevenlabs-forced-alignment",
            "endpoint": "/v1/forced-alignment",
            "generatedAt": generated_at,
            "canonicalTextSha256": canonical_sha256,
            "rawArtifact": raw_artifact,
            "overallLoss": overall_loss,
        },
        "reviewStatus": "candidate",
        "warnings": [
            "ElevenLabs alignment loss is uncalibrated for Quran recitation.",
            "Candidate boundaries require independent confidence and anomaly checks before publication.",
        ],
        "ayahs": ayahs,
    }
    if prelude is not None:
        candidate["prelude"] = prelude
    if first_aligned_start_ms > 0:
        candidate["leadingUnassigned"] = {
            "startMs": 0,
            "endMs": first_aligned_start_ms,
        }
    return candidate


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    os.replace(temporary, path)


def _fetch_canonical_verses(
    surah: int, expected_count: int
) -> tuple[str, list[dict[str, str]]]:
    url = f"https://api.quran.com/api/v4/quran/verses/uthmani?chapter_number={surah}"
    request = urllib.request.Request(
        url, headers={"User-Agent": "IYF-Quran-Alignment/0.1"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = _strict_json_loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Canonical Quran source returned a non-object response")
    return url, canonical_verses_from_payload(surah, expected_count, payload)


def _call_elevenlabs(
    audio_path: Path,
    text_path: Path,
    timeout: int,
    expected_audio_sha256: str,
) -> dict[str, Any]:
    if os.name != "posix":
        raise RuntimeError("Secure descriptor-based upload requires a POSIX system")
    with audio_path.open("rb") as audio_file, text_path.open("rb") as text_file:
        digest = hashlib.sha256()
        for chunk in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(chunk)
        if digest.hexdigest() != expected_audio_sha256:
            raise ValueError("Audio changed after track validation and before upload")
        audio_file.seek(0)
        api_key = load_api_key()
        command, config = curl_alignment_command(
            audio_path=f"/dev/fd/{audio_file.fileno()}",
            text_path=f"/dev/fd/{text_file.fileno()}",
            api_key=api_key,
            upload_name=audio_path.name,
        )
        result = subprocess.run(
            command,
            input=config,
            capture_output=True,
            text=True,
            timeout=timeout,
            pass_fds=(audio_file.fileno(), text_file.fileno()),
            env=sanitized_subprocess_environment(),
        )
    if result.returncode != 0:
        response_body = result.stdout.replace(api_key, "[REDACTED]").strip()[:2000]
        error = result.stderr.replace(api_key, "[REDACTED]").strip()[:2000]
        raise RuntimeError(
            f"ElevenLabs request failed with curl exit {result.returncode}: "
            f"{error or response_body or 'no response body'}"
        )
    try:
        payload = _strict_json_loads(result.stdout)
    except (json.JSONDecodeError, ValueError) as error:
        raise ValueError("ElevenLabs returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise ValueError("ElevenLabs returned a non-object response")
    return payload


def validated_raw_response(
    raw_payload: dict[str, Any],
    track: dict[str, Any],
    canonical_sha256: str,
) -> tuple[dict[str, Any], str]:
    track_surah = track.get("surah")
    if (
        raw_payload.get("schemaVersion") != 1
        or isinstance(raw_payload.get("schemaVersion"), bool)
        or isinstance(track_surah, bool)
        or not isinstance(track_surah, int)
        or raw_payload.get("surah") != track_surah
        or isinstance(raw_payload.get("surah"), bool)
        or raw_payload.get("endpoint") != ELEVENLABS_URL
        or raw_payload.get("audioSha256") != track.get("sha256")
        or raw_payload.get("canonicalTextSha256") != canonical_sha256
    ):
        raise ValueError("Raw artifact corpus identity does not match current inputs")
    response = raw_payload.get("response")
    generated_at = raw_payload.get("generatedAt")
    if (
        not isinstance(response, dict)
        or not isinstance(generated_at, str)
        or not generated_at.strip()
    ):
        raise ValueError("Raw artifact is missing its response or generation time")
    try:
        generated_at_value = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("Raw artifact has an invalid generation time") from error
    if generated_at_value.tzinfo is None or generated_at_value.utcoffset() is None:
        raise ValueError("Raw artifact generation time must include a timezone")
    return response, generated_at


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("surah", type=int, nargs="+")
    parser.add_argument(
        "--track-index", type=Path, default=Path(".cache/alignment/track-index.json")
    )
    parser.add_argument(
        "--audio-dir", type=Path, default=Path(".cache/audio/muhammad-al-faqih")
    )
    parser.add_argument(
        "--canonical-dir", type=Path, default=Path(".cache/alignment/canonical")
    )
    parser.add_argument(
        "--raw-dir", type=Path, default=Path(".cache/alignment/elevenlabs/raw")
    )
    parser.add_argument(
        "--candidate-dir",
        type=Path,
        default=Path(".cache/alignment/elevenlabs/candidates"),
    )
    parser.add_argument("--reuse-raw", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--timeout", type=int, default=7200)
    args = parser.parse_args()

    if args.reuse_raw and args.force:
        parser.error("--reuse-raw and --force are mutually exclusive")
    if any(not 1 <= surah <= 114 for surah in args.surah):
        parser.error("Every Surah must be between 1 and 114")
    if len(set(args.surah)) != len(args.surah):
        parser.error("Duplicate Surah numbers are not allowed")

    track_index = _strict_json_loads(args.track_index.read_text(encoding="utf-8"))
    if not isinstance(track_index, dict):
        raise ValueError("Track index must be an object")

    for surah in args.surah:
        track, audio_path = validated_track(track_index, surah, args.audio_dir)
        source_url, verses = _fetch_canonical_verses(surah, track["ayahCount"])
        plan = build_alignment_plan(surah, verses)
        canonical_encoded = json.dumps(
            verses, ensure_ascii=False, sort_keys=True, separators=(",", ":")
        ).encode("utf-8")
        canonical_sha256 = hashlib.sha256(canonical_encoded).hexdigest()

        canonical_path = args.canonical_dir / f"{surah:03d}.json"
        text_path = args.canonical_dir / f"{surah:03d}.alignment.txt"
        _atomic_write_json(
            canonical_path,
            {
                "schemaVersion": 1,
                "surah": surah,
                "sourceUrl": source_url,
                "canonicalTextSha256": canonical_sha256,
                "verses": verses,
            },
        )
        text_path.parent.mkdir(parents=True, exist_ok=True)
        text_path.write_text(plan["text"] + "\n", encoding="utf-8")

        raw_path = args.raw_dir / f"{surah:03d}.json"
        with _exclusive_raw_charge_lock(raw_path):
            response_mode = _raw_response_mode(
                raw_path, reuse_raw=args.reuse_raw, force=args.force
            )
            if response_mode == "reuse":
                raw_payload = _strict_json_loads(raw_path.read_text(encoding="utf-8"))
                response, generated_at = validated_raw_response(
                    raw_payload, track, canonical_sha256
                )
            else:
                request_state_path = _raw_request_state_path(raw_path)
                request_started_at = datetime.now(timezone.utc).isoformat()
                _atomic_write_json(
                    request_state_path,
                    {
                        "schemaVersion": 1,
                        "status": "requestOutcomeUncertain",
                        "surah": surah,
                        "audioSha256": track["sha256"],
                        "canonicalTextSha256": canonical_sha256,
                        "endpoint": ELEVENLABS_URL,
                        "requestStartedAt": request_started_at,
                    },
                )
                response = _call_elevenlabs(
                    audio_path, text_path, args.timeout, track["sha256"]
                )
                generated_at = datetime.now(timezone.utc).isoformat()
                _atomic_write_json(
                    raw_path,
                    {
                        "schemaVersion": 1,
                        "surah": surah,
                        "audioSha256": track["sha256"],
                        "canonicalTextSha256": canonical_sha256,
                        "generatedAt": generated_at,
                        "endpoint": ELEVENLABS_URL,
                        "response": response,
                    },
                )
                request_state_path.unlink()

        try:
            raw_artifact = str(raw_path.relative_to(ROOT))
        except ValueError:
            raw_artifact = str(raw_path)
        candidate = build_candidate(
            surah=surah,
            track=track,
            plan=plan,
            response=response,
            canonical_sha256=canonical_sha256,
            raw_artifact=raw_artifact,
            generated_at=generated_at,
        )
        candidate_path = args.candidate_dir / f"{surah:03d}.json"
        _atomic_write_json(candidate_path, candidate)
        print(
            f"candidate={candidate_path} surah={surah} ayahs={len(candidate['ayahs'])} "
            f"words={len(response['words'])} loss={response['loss']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
