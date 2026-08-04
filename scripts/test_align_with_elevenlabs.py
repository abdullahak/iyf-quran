from __future__ import annotations

import hashlib
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.align_with_elevenlabs import (
    _call_elevenlabs,
    _exclusive_raw_charge_lock,
    _raw_request_state_path,
    _raw_response_mode,
    build_alignment_plan,
    build_candidate,
    canonical_verses_from_payload,
    curl_alignment_command,
    load_api_key,
    normalize_alignment_text,
    sanitized_subprocess_environment,
    validated_raw_response,
    validated_track,
)


class ElevenLabsAlignmentTests(unittest.TestCase):
    def test_raw_response_mode_fails_closed_and_charge_lock_is_exclusive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            raw_path = Path(directory) / "001.json"
            with self.assertRaisesRegex(FileNotFoundError, "reuse"):
                _raw_response_mode(raw_path, reuse_raw=True, force=False)
            self.assertEqual(
                _raw_response_mode(raw_path, reuse_raw=False, force=False), "request"
            )

            request_state_path = _raw_request_state_path(raw_path)
            request_state_path.write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "outcome is uncertain"):
                _raw_response_mode(raw_path, reuse_raw=False, force=False)
            self.assertEqual(
                _raw_response_mode(raw_path, reuse_raw=False, force=True), "request"
            )
            request_state_path.unlink()

            raw_path.write_text("{}", encoding="utf-8")
            self.assertEqual(
                _raw_response_mode(raw_path, reuse_raw=True, force=False), "reuse"
            )
            with self.assertRaisesRegex(FileExistsError, "Refusing to charge"):
                _raw_response_mode(raw_path, reuse_raw=False, force=False)

            raw_path.unlink()
            raw_path.mkdir()
            with self.assertRaisesRegex(ValueError, "regular file"):
                _raw_response_mode(raw_path, reuse_raw=False, force=True)
            raw_path.rmdir()

            with _exclusive_raw_charge_lock(raw_path):
                with self.assertRaisesRegex(RuntimeError, "already processing"):
                    with _exclusive_raw_charge_lock(raw_path):
                        self.fail("Concurrent lock unexpectedly acquired")

    def test_normalizes_uthmani_marks_without_changing_word_order(self) -> None:
        self.assertEqual(
            normalize_alignment_text(" بِسْمِ ٱللَّهِ ۛ ٱلرَّحْمَـٰنِ "),
            "بسم الله الرحمن",
        )

    def test_models_basmala_as_a_prelude_except_fatiha_and_at_tawbah(self) -> None:
        fatiha = build_alignment_plan(
            1,
            [{"key": "1:1", "text": "بِسْمِ ٱللَّهِ"}],
        )
        al_baqarah = build_alignment_plan(
            2,
            [{"key": "2:1", "text": "الٓمٓ"}],
        )
        at_tawbah = build_alignment_plan(
            9,
            [{"key": "9:1", "text": "بَرَآءَةٌ مِّنَ ٱللَّهِ"}],
        )

        self.assertEqual([token["kind"] for token in fatiha["tokens"]], ["ayah", "ayah"])
        self.assertEqual(al_baqarah["tokens"][0]["kind"], "prelude")
        self.assertEqual(al_baqarah["tokens"][0]["text"], "بسم")
        self.assertFalse(any(token["kind"] == "prelude" for token in at_tawbah["tokens"]))

    def test_leading_unaligned_audio_is_not_labeled_silence(self) -> None:
        plan = build_alignment_plan(
            9,
            [{"key": "9:1", "text": "بَرَآءَةٌ"}],
        )
        candidate = build_candidate(
            surah=9,
            track={"sha256": "exact-hash", "durationMs": 1000, "ayahCount": 1},
            plan=plan,
            response={
                "words": [
                    {"text": plan["tokens"][0]["text"], "start": 0.25, "end": 0.5, "loss": 0.1}
                ],
                "characters": [],
                "loss": 0.1,
            },
            canonical_sha256="canonical-hash",
            raw_artifact="raw.json",
            generated_at="2026-08-04T00:00:00Z",
        )

        self.assertNotIn("prelude", candidate)
        self.assertEqual(
            candidate["leadingUnassigned"], {"startMs": 0, "endMs": 250}
        )

    def test_builds_hash_locked_candidate_from_exact_supplied_words(self) -> None:
        plan = build_alignment_plan(
            1,
            [
                {"key": "1:1", "text": "بِسْمِ ٱللَّهِ"},
                {"key": "1:2", "text": "ٱلْحَمْدُ لِلَّهِ"},
            ],
        )
        response = {
            "characters": [],
            "words": [
                {"text": "بسم", "start": 0.5, "end": 1.0, "loss": 0.1},
                {"text": "الله", "start": 1.1, "end": 2.0, "loss": 0.2},
                {"text": "الحمد", "start": 2.2, "end": 3.0, "loss": 0.3},
                {"text": "لله", "start": 3.1, "end": 4.0, "loss": 0.4},
            ],
            "loss": 0.25,
        }

        candidate = build_candidate(
            surah=1,
            track={"sha256": "exact-hash", "durationMs": 5000, "ayahCount": 2},
            plan=plan,
            response=response,
            canonical_sha256="canonical-hash",
            raw_artifact=".cache/alignment/elevenlabs/raw/001.json",
            generated_at="2026-08-04T00:00:00Z",
        )

        self.assertEqual(candidate["audioSha256"], "exact-hash")
        self.assertEqual([point["startMs"] for point in candidate["ayahs"]], [500, 2200])
        self.assertEqual(candidate["ayahs"][0]["alignmentLoss"], 0.15)
        self.assertEqual(candidate["ayahs"][1]["alignmentLoss"], 0.35)
        self.assertEqual(candidate["reviewStatus"], "candidate")
        self.assertEqual(candidate["source"]["overallLoss"], 0.25)

    def test_rejects_response_that_does_not_match_the_supplied_words(self) -> None:
        plan = build_alignment_plan(
            1,
            [{"key": "1:1", "text": "بِسْمِ ٱللَّهِ"}],
        )
        response = {
            "characters": [],
            "words": [
                {"text": "بسم", "start": 0.5, "end": 1.0, "loss": 0.1},
                {"text": "الرحمن", "start": 1.1, "end": 2.0, "loss": 0.2},
            ],
            "loss": 0.15,
        }

        with self.assertRaisesRegex(ValueError, "word sequence"):
            build_candidate(
                surah=1,
                track={"sha256": "exact-hash", "durationMs": 5000, "ayahCount": 1},
                plan=plan,
                response=response,
                canonical_sha256="canonical-hash",
                raw_artifact="raw.json",
                generated_at="2026-08-04T00:00:00Z",
            )

    def test_ignores_provider_whitespace_records_when_matching_words(self) -> None:
        plan = build_alignment_plan(
            1,
            [{"key": "1:1", "text": "بِسْمِ ٱللَّهِ"}],
        )
        response = {
            "characters": [],
            "words": [
                {"text": "بسم", "start": 0.5, "end": 1.0, "loss": 0.1},
                {"text": " ", "start": 1.0, "end": 1.1, "loss": 1.5},
                {"text": "الله", "start": 1.1, "end": 2.0, "loss": 0.2},
            ],
            "loss": 0.2,
        }

        candidate = build_candidate(
            surah=1,
            track={"sha256": "exact-hash", "durationMs": 5000, "ayahCount": 1},
            plan=plan,
            response=response,
            canonical_sha256="canonical-hash",
            raw_artifact="raw.json",
            generated_at="2026-08-04T00:00:00Z",
        )
        self.assertEqual(candidate["ayahs"][0]["wordCount"], 2)
        self.assertEqual(candidate["ayahs"][0]["alignmentLoss"], 0.15)

    def test_rejects_non_whitespace_provider_records_with_no_arabic_text(self) -> None:
        plan = build_alignment_plan(1, [{"key": "1:1", "text": "بِسْمِ"}])
        response = {
            "characters": [],
            "words": [
                {"text": "HELLO", "start": 0.1, "end": 0.2, "loss": 0.1},
                {"text": "بسم", "start": 0.3, "end": 0.8, "loss": 0.1},
            ],
            "loss": 0.1,
        }
        with self.assertRaisesRegex(ValueError, "non-whitespace"):
            build_candidate(
                surah=1,
                track={"sha256": "exact-hash", "durationMs": 1000, "ayahCount": 1},
                plan=plan,
                response=response,
                canonical_sha256="canonical-hash",
                raw_artifact="raw.json",
                generated_at="2026-08-04T00:00:00Z",
            )

    def test_rejects_overlapping_provider_words(self) -> None:
        plan = build_alignment_plan(1, [{"key": "1:1", "text": "بِسْمِ ٱللَّهِ"}])
        response = {
            "characters": [],
            "words": [
                {"text": "بسم", "start": 0.1, "end": 0.8, "loss": 0.1},
                {"text": "الله", "start": 0.5, "end": 0.9, "loss": 0.1},
            ],
            "loss": 0.1,
        }
        with self.assertRaisesRegex(ValueError, "overlap"):
            build_candidate(
                surah=1,
                track={"sha256": "exact-hash", "durationMs": 1000, "ayahCount": 1},
                plan=plan,
                response=response,
                canonical_sha256="canonical-hash",
                raw_artifact="raw.json",
                generated_at="2026-08-04T00:00:00Z",
            )

    def test_rejects_boolean_provider_numbers(self) -> None:
        plan = build_alignment_plan(1, [{"key": "1:1", "text": "بِسْمِ"}])
        response = {
            "characters": [],
            "words": [{"text": "بسم", "start": True, "end": 0.8, "loss": 0.1}],
            "loss": 0.1,
        }
        with self.assertRaisesRegex(ValueError, "finite number"):
            build_candidate(
                surah=1,
                track={"sha256": "exact-hash", "durationMs": 1000, "ayahCount": 1},
                plan=plan,
                response=response,
                canonical_sha256="canonical-hash",
                raw_artifact="raw.json",
                generated_at="2026-08-04T00:00:00Z",
            )

        response["words"][0].update({"start": 0.1, "loss": -0.1})
        with self.assertRaisesRegex(ValueError, "negative loss"):
            build_candidate(
                surah=1,
                track={"sha256": "exact-hash", "durationMs": 1000, "ayahCount": 1},
                plan=plan,
                response=response,
                canonical_sha256="canonical-hash",
                raw_artifact="raw.json",
                generated_at="2026-08-04T00:00:00Z",
            )

    def test_flags_provider_words_collapsed_to_near_zero_duration(self) -> None:
        plan = build_alignment_plan(
            1,
            [{"key": "1:1", "text": "بِسْمِ ٱللَّهِ"}],
        )
        response = {
            "characters": [],
            "words": [
                {"text": "بسم", "start": 0.5, "end": 1.0, "loss": 0.1},
                {"text": "الله", "start": 1.0, "end": 1.001, "loss": 3.0},
            ],
            "loss": 0.5,
        }
        candidate = build_candidate(
            surah=1,
            track={"sha256": "exact-hash", "durationMs": 5000, "ayahCount": 1},
            plan=plan,
            response=response,
            canonical_sha256="canonical-hash",
            raw_artifact="raw.json",
            generated_at="2026-08-04T00:00:00Z",
        )
        self.assertEqual(candidate["ayahs"][0]["collapsedWordCount"], 1)
        self.assertEqual(candidate["ayahs"][0]["minWordDurationMs"], 1)

        response["words"][1].update(
            {"start": 3144.68, "end": 3144.69, "loss": 3.0}
        )
        response["words"][0].update(
            {"start": 3144.0, "end": 3144.68, "loss": 0.1}
        )
        candidate = build_candidate(
            surah=1,
            track={"sha256": "exact-hash", "durationMs": 4_000_000, "ayahCount": 1},
            plan=plan,
            response=response,
            canonical_sha256="canonical-hash",
            raw_artifact="raw.json",
            generated_at="2026-08-04T00:00:00Z",
        )
        self.assertEqual(candidate["ayahs"][0]["minWordDurationMs"], 10)
        self.assertEqual(candidate["ayahs"][0]["collapsedWordCount"], 1)

    def test_validates_canonical_verse_keys_and_count(self) -> None:
        verses = canonical_verses_from_payload(
            1,
            2,
            {
                "verses": [
                    {"verse_key": "1:1", "text_uthmani": "بِسْمِ ٱللَّهِ"},
                    {"verse_key": "1:2", "text_uthmani": "ٱلْحَمْدُ لِلَّهِ"},
                ]
            },
        )
        self.assertEqual(verses[1], {"key": "1:2", "text": "ٱلْحَمْدُ لِلَّهِ"})

        with self.assertRaisesRegex(ValueError, "expected 2"):
            canonical_verses_from_payload(
                1,
                2,
                {"verses": [{"verse_key": "1:1", "text_uthmani": "بسم الله"}]},
            )

    def test_keeps_api_key_out_of_curl_process_arguments(self) -> None:
        command, config = curl_alignment_command(
            audio_path="/tmp/001.mp3",
            text_path="/tmp/001.txt",
            api_key="sk_test",
        )
        self.assertNotIn("sk_test", " ".join(command))
        self.assertEqual(command[1], "--disable")
        self.assertIn('header = "xi-api-key: sk_test"', config)
        self.assertIn("file=@/tmp/001.mp3", command)
        self.assertIn("text=</tmp/001.txt", command)

    def test_validates_exact_audio_bytes_before_upload(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            audio_dir = Path(directory)
            audio_path = audio_dir / "001.mp3"
            audio_path.write_bytes(b"exact-audio")
            track_index = {
                "hashesVerified": True,
                "tracks": [
                    {
                        "surah": 1,
                        "file": "001.mp3",
                        "sha256": hashlib.sha256(b"exact-audio").hexdigest(),
                        "durationMs": 5000,
                        "ayahCount": 7,
                    }
                ],
            }

            duration_probe = lambda _: 5000
            track, returned_path = validated_track(
                track_index, 1, audio_dir, duration_probe=duration_probe
            )
            self.assertEqual(track["ayahCount"], 7)
            self.assertEqual(returned_path, audio_path.resolve())

            track_index["tracks"][0]["surah"] = True
            with self.assertRaisesRegex(ValueError, "exactly one time"):
                validated_track(
                    track_index, 1, audio_dir, duration_probe=duration_probe
                )
            track_index["tracks"][0]["surah"] = 1

            audio_path.write_bytes(b"changed-audio")
            with self.assertRaisesRegex(ValueError, "SHA-256"):
                validated_track(
                    track_index, 1, audio_dir, duration_probe=duration_probe
                )

    def test_rejects_duplicate_tracks_escaped_paths_and_symlinks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            audio_dir = root / "audio"
            audio_dir.mkdir()
            outside = root / "outside.mp3"
            outside.write_bytes(b"exact-audio")
            digest = hashlib.sha256(b"exact-audio").hexdigest()
            track = {
                "surah": 1,
                "file": "../outside.mp3",
                "sha256": digest,
                "durationMs": 5000,
                "ayahCount": 7,
            }
            with self.assertRaisesRegex(ValueError, "file name"):
                validated_track({"hashesVerified": True, "tracks": [track]}, 1, audio_dir)

            safe_track = {**track, "file": "001.mp3"}
            (audio_dir / "001.mp3").symlink_to(outside)
            with self.assertRaisesRegex(ValueError, "symlink"):
                validated_track(
                    {"hashesVerified": True, "tracks": [safe_track]}, 1, audio_dir
                )

            with self.assertRaisesRegex(ValueError, "exactly one"):
                validated_track(
                    {"hashesVerified": True, "tracks": [safe_track, safe_track]},
                    1,
                    audio_dir,
                )

    def test_reads_api_key_from_environment_without_logging_it(self) -> None:
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": "sk_env"}):
            self.assertEqual(load_api_key(), "sk_env")

        environment = sanitized_subprocess_environment(
            {"PATH": "/usr/bin", "ELEVENLABS_API_KEY": "sk_env"}
        )
        self.assertEqual(environment, {"PATH": "/usr/bin"})

    def test_uploads_verified_descriptors_without_inheriting_the_api_key(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_curl = root / "curl"
            fake_curl.write_text(
                """#!/usr/bin/env python3
import json
import os
import sys

if "ELEVENLABS_API_KEY" in os.environ:
    raise SystemExit("secret inherited")
config = sys.stdin.read()
if "sk_env" not in config:
    raise SystemExit("secret missing from stdin config")
file_form = next(value for value in sys.argv if value.startswith("file=@"))
text_form = next(value for value in sys.argv if value.startswith("text=<"))
audio_path = file_form.split("@", 1)[1].split(";filename=", 1)[0]
text_path = text_form.split("<", 1)[1]
with open(audio_path, "rb") as audio:
    audio_bytes = len(audio.read())
with open(text_path, "rb") as text:
    text_bytes = len(text.read())
print(json.dumps({"audioBytes": audio_bytes, "textBytes": text_bytes}))
""",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)
            audio_path = root / "001.mp3"
            text_path = root / "001.txt"
            audio_path.write_bytes(b"verified-audio")
            text_path.write_text("بسم الله\n", encoding="utf-8")
            expected_hash = hashlib.sha256(b"verified-audio").hexdigest()
            with patch.dict(
                os.environ,
                {
                    "PATH": f"{root}:{os.environ.get('PATH', '')}",
                    "ELEVENLABS_API_KEY": "sk_env",
                },
            ):
                payload = _call_elevenlabs(
                    audio_path, text_path, timeout=5, expected_audio_sha256=expected_hash
                )
            self.assertEqual(payload["audioBytes"], len(b"verified-audio"))
            self.assertGreater(payload["textBytes"], 0)

    def test_redacts_api_key_if_curl_error_echoes_stdin(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fake_curl = root / "curl"
            fake_curl.write_text(
                """#!/usr/bin/env python3
import sys
sys.stderr.write(sys.stdin.read())
raise SystemExit(22)
""",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)
            audio_path = root / "001.mp3"
            text_path = root / "001.txt"
            audio_path.write_bytes(b"verified-audio")
            text_path.write_text("بسم الله\n", encoding="utf-8")
            expected_hash = hashlib.sha256(b"verified-audio").hexdigest()
            with patch.dict(
                os.environ,
                {
                    "PATH": f"{root}:{os.environ.get('PATH', '')}",
                    "ELEVENLABS_API_KEY": "sk_env",
                },
            ):
                with self.assertRaises(RuntimeError) as raised:
                    _call_elevenlabs(
                        audio_path,
                        text_path,
                        timeout=5,
                        expected_audio_sha256=expected_hash,
                    )
            self.assertNotIn("sk_env", str(raised.exception))

    def test_rejects_reused_raw_response_for_different_corpus_identity(self) -> None:
        raw = {
            "schemaVersion": 1,
            "surah": 1,
            "audioSha256": "audio-hash",
            "canonicalTextSha256": "text-hash",
            "generatedAt": "2026-08-04T00:00:00Z",
            "endpoint": "https://api.elevenlabs.io/v1/forced-alignment",
            "response": {"words": [], "characters": [], "loss": 0.1},
        }
        response, generated_at = validated_raw_response(
            raw,
            {"surah": 1, "sha256": "audio-hash"},
            "text-hash",
        )
        self.assertEqual(response["loss"], 0.1)
        self.assertEqual(generated_at, "2026-08-04T00:00:00Z")

        with self.assertRaisesRegex(ValueError, "identity"):
            validated_raw_response(
                raw, {"surah": 1, "sha256": "different-audio"}, "text-hash"
            )

        raw["surah"] = 2
        with self.assertRaisesRegex(ValueError, "identity"):
            validated_raw_response(
                raw, {"surah": 1, "sha256": "audio-hash"}, "text-hash"
            )

        raw["surah"] = 1
        for invalid_timestamp in ("", "not-a-timestamp", "2026-08-04T00:00:00"):
            raw["generatedAt"] = invalid_timestamp
            with self.subTest(generatedAt=invalid_timestamp):
                with self.assertRaisesRegex(ValueError, "generation time"):
                    validated_raw_response(
                        raw,
                        {"surah": 1, "sha256": "audio-hash"},
                        "text-hash",
                    )


if __name__ == "__main__":
    unittest.main()
