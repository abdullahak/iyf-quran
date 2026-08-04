from __future__ import annotations

import copy
import unittest

from scripts.analyze_alignment_pilot import build_report


def bind_candidate_identity(candidate: dict) -> dict:
    surah = candidate["surah"]
    candidate["schemaVersion"] = 1
    candidate["audioSha256"] = f"{surah:064x}"
    candidate.setdefault("source", {})["canonicalTextSha256"] = f"{surah + 114:064x}"
    return candidate


def identity_inputs(candidates: list[dict]) -> tuple[dict, list[dict]]:
    unique = {candidate["surah"]: candidate for candidate in candidates}
    track_index = {
        "schemaVersion": 1,
        "hashesVerified": True,
        "tracks": [
            {
                "surah": surah,
                "sha256": candidate["audioSha256"],
                "durationMs": candidate["durationMs"],
                "ayahCount": len(candidate["ayahs"]),
            }
            for surah, candidate in sorted(unique.items())
        ],
    }
    canonical_records = [
        {
            "schemaVersion": 1,
            "surah": surah,
            "canonicalTextSha256": candidate["source"]["canonicalTextSha256"],
            "verses": [{} for _ in candidate["ayahs"]],
        }
        for surah, candidate in sorted(unique.items())
    ]
    return track_index, canonical_records


def build_bound_report(
    candidates: list[dict],
    top: int = 50,
    sample: int = 0,
    seed: str = "iyf-quran-alignment-v1",
) -> dict:
    return build_report(
        candidates,
        *identity_inputs(candidates),
        top=top,
        sample=sample,
        seed=seed,
    )


class AlignmentPilotReportTests(unittest.TestCase):
    def test_ranks_outliers_without_claiming_calibrated_confidence(self) -> None:
        candidate = bind_candidate_identity(
            {
                "surah": 1,
                "durationMs": 22000,
                "reviewStatus": "candidate",
                "source": {
                    "method": "elevenlabs-forced-alignment",
                    "overallLoss": 0.2,
                },
                "ayahs": [
                    {
                        "key": f"1:{ayah}",
                        "ayah": ayah,
                        "startMs": (ayah - 1) * 2000,
                        "alignmentLoss": 2.0 if ayah == 5 else 0.1,
                        "maxWordLoss": 3.0 if ayah == 5 else 0.2,
                        "wordCount": 4,
                        "collapsedWordCount": 1 if ayah == 5 else 0,
                    }
                    for ayah in range(1, 11)
                ],
            }
        )

        report = build_bound_report([candidate], top=3)

        self.assertEqual(report["calibrationStatus"], "uncalibrated")
        self.assertEqual(report["surahCount"], 1)
        self.assertEqual(report["ayahCount"], 10)
        self.assertEqual(report["topAnomalies"][0]["key"], "1:5")
        self.assertIn("highAlignmentLoss", report["topAnomalies"][0]["reasons"])
        self.assertIn("collapsedProviderWords", report["topAnomalies"][0]["reasons"])

    def test_rejects_non_candidate_or_wrong_provider_input(self) -> None:
        candidate = bind_candidate_identity(
            {
                "surah": 1,
                "durationMs": 1000,
                "reviewStatus": "verified",
                "source": {"method": "manual"},
                "ayahs": [
                    {
                        "key": "1:1",
                        "ayah": 1,
                        "startMs": 0,
                        "alignmentLoss": 0.1,
                        "maxWordLoss": 0.2,
                        "wordCount": 1,
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ValueError, "candidate"):
            build_bound_report([candidate])

    def test_produces_a_deterministic_random_review_sample(self) -> None:
        candidate = bind_candidate_identity(
            {
                "surah": 1,
                "durationMs": 11000,
                "reviewStatus": "candidate",
                "source": {
                    "method": "elevenlabs-forced-alignment",
                    "overallLoss": 0.2,
                },
                "ayahs": [
                    {
                        "key": f"1:{ayah}",
                        "ayah": ayah,
                        "startMs": (ayah - 1) * 1000,
                        "alignmentLoss": 0.1,
                        "maxWordLoss": 0.2,
                        "wordCount": 2,
                        "collapsedWordCount": 0,
                    }
                    for ayah in range(1, 11)
                ],
            }
        )

        second_candidate = copy.deepcopy(candidate)
        second_candidate["surah"] = 2
        for ayah in second_candidate["ayahs"]:
            ayah["key"] = f"2:{ayah['ayah']}"
        bind_candidate_identity(second_candidate)

        first = build_bound_report(
            [candidate, second_candidate], sample=4, seed="pilot-v1"
        )
        second = build_bound_report(
            [second_candidate, candidate], sample=4, seed="pilot-v1"
        )
        self.assertEqual(first["randomSample"], second["randomSample"])
        self.assertEqual(len(first["randomSample"]), 4)
        self.assertEqual(len({point["key"] for point in first["randomSample"]}), 4)

    def test_rejects_duplicate_surahs_and_nonfinite_metrics(self) -> None:
        candidate = bind_candidate_identity(
            {
                "surah": 1,
                "durationMs": 2000,
                "reviewStatus": "candidate",
                "source": {"method": "elevenlabs-forced-alignment"},
                "ayahs": [
                    {
                        "key": "1:1",
                        "ayah": 1,
                        "startMs": 100,
                        "alignmentLoss": 0.1,
                        "maxWordLoss": 0.2,
                        "wordCount": 2,
                    }
                ],
            }
        )
        with self.assertRaisesRegex(ValueError, "Duplicate Surah"):
            build_bound_report([candidate, candidate])

        candidate["ayahs"][0]["alignmentLoss"] = float("nan")
        with self.assertRaisesRegex(ValueError, "finite"):
            build_bound_report([candidate])

        candidate["ayahs"][0]["alignmentLoss"] = 0.1
        candidate["surah"] = True
        with self.assertRaisesRegex(ValueError, "Surah.*integer"):
            build_bound_report([candidate])

        candidate["surah"] = 1
        candidate["ayahs"][0]["alignmentLoss"] = -0.1
        with self.assertRaisesRegex(ValueError, "non-negative"):
            build_bound_report([candidate])

    def test_requires_independent_audio_and_canonical_identities(self) -> None:
        candidate = bind_candidate_identity(
            {
                "surah": 1,
                "durationMs": 2000,
                "reviewStatus": "candidate",
                "source": {"method": "elevenlabs-forced-alignment"},
                "ayahs": [
                    {
                        "key": "1:1",
                        "ayah": 1,
                        "startMs": 100,
                        "alignmentLoss": 0.1,
                        "maxWordLoss": 0.2,
                        "wordCount": 2,
                    }
                ],
            }
        )
        track_index, canonical_records = identity_inputs([candidate])

        report = build_report([candidate], track_index, canonical_records)
        self.assertEqual(
            report["corpusIdentities"],
            [
                {
                    "surah": 1,
                    "audioSha256": candidate["audioSha256"],
                    "canonicalTextSha256": candidate["source"][
                        "canonicalTextSha256"
                    ],
                    "durationMs": 2000,
                    "ayahCount": 1,
                }
            ],
        )

        wrong_audio = copy.deepcopy(candidate)
        wrong_audio["audioSha256"] = "f" * 64
        with self.assertRaisesRegex(ValueError, "corpus identity"):
            build_report([wrong_audio], track_index, canonical_records)

        wrong_text = copy.deepcopy(candidate)
        wrong_text["source"]["canonicalTextSha256"] = "e" * 64
        with self.assertRaisesRegex(ValueError, "corpus identity"):
            build_report([wrong_text], track_index, canonical_records)


if __name__ == "__main__":
    unittest.main()
