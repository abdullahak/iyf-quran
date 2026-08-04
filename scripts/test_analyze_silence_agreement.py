from __future__ import annotations

import unittest

from scripts.analyze_silence_agreement import assess_boundaries, parse_silences


class SilenceAgreementTests(unittest.TestCase):
    def test_parses_ffmpeg_silence_intervals(self) -> None:
        log = """
[silencedetect @ x] silence_start: 1.8
[silencedetect @ x] silence_end: 2.1 | silence_duration: 0.3
[silencedetect @ x] silence_start: 3.5
[silencedetect @ x] silence_end: 3.9 | silence_duration: 0.4
"""
        self.assertEqual(parse_silences(log), [(1800, 2100), (3500, 3900)])

    def test_marks_nearby_pause_support_and_silence_conflicts(self) -> None:
        candidate = {
            "surah": 1,
            "durationMs": 6000,
            "ayahs": [
                {"key": "1:1", "ayah": 1, "startMs": 500},
                {"key": "1:2", "ayah": 2, "startMs": 2200},
                {"key": "1:3", "ayah": 3, "startMs": 3600},
                {"key": "1:4", "ayah": 4, "startMs": 5000},
            ],
        }
        result = assess_boundaries(
            candidate,
            [(1800, 2100), (3500, 3900)],
            tolerance_ms=350,
        )

        self.assertEqual(result["testedBoundaryCount"], 3)
        self.assertEqual(result["nearSilenceEndCount"], 1)
        self.assertEqual(result["insideSilenceCount"], 1)
        by_key = {boundary["key"]: boundary for boundary in result["boundaries"]}
        self.assertEqual(by_key["1:2"]["nearestSilenceEndDeltaMs"], 100)
        self.assertTrue(by_key["1:3"]["startsInsideSilence"])
        self.assertIsNone(by_key["1:3"]["nearestSilenceEndDeltaMs"])
        self.assertIsNone(by_key["1:4"]["nearestSilenceEndDeltaMs"])

    def test_treats_tiny_silence_end_overlap_as_detector_jitter(self) -> None:
        candidate = {
            "surah": 1,
            "durationMs": 3000,
            "ayahs": [
                {"key": "1:1", "ayah": 1, "startMs": 500},
                {"key": "1:2", "ayah": 2, "startMs": 2095},
            ],
        }
        result = assess_boundaries(candidate, [(1800, 2100)], tolerance_ms=250)
        boundary = result["boundaries"][0]
        self.assertEqual(boundary["insideSilenceByMs"], 5)
        self.assertFalse(boundary["startsInsideSilence"])
        self.assertEqual(result["insideSilenceCount"], 0)

    def test_treats_exact_silence_start_as_inside_not_pause_support(self) -> None:
        candidate = {
            "surah": 1,
            "durationMs": 3000,
            "ayahs": [
                {"key": "1:1", "ayah": 1, "startMs": 500},
                {"key": "1:2", "ayah": 2, "startMs": 1800},
            ],
        }
        result = assess_boundaries(candidate, [(1800, 2100)], tolerance_ms=350)
        boundary = result["boundaries"][0]
        self.assertTrue(boundary["startsInsideSilence"])
        self.assertIsNone(boundary["nearestSilenceEndDeltaMs"])
        self.assertEqual(result["nearSilenceEndCount"], 0)

    def test_rejects_malformed_keys_and_future_silence_as_support(self) -> None:
        candidate = {
            "surah": 1,
            "durationMs": 3000,
            "ayahs": [
                {"key": "1:1", "ayah": 1, "startMs": 500},
                {"key": "2:7", "ayah": 2, "startMs": 1700},
            ],
        }
        with self.assertRaisesRegex(ValueError, "Ayah 1:2"):
            assess_boundaries(candidate, [(1800, 2100)])

        candidate["ayahs"][1]["key"] = "1:2"
        result = assess_boundaries(candidate, [(1800, 2100)], tolerance_ms=750)
        self.assertEqual(result["nearSilenceEndCount"], 0)
        self.assertIsNone(result["boundaries"][0]["nearestSilenceEndDeltaMs"])

        candidate["durationMs"] = 1600
        with self.assertRaisesRegex(ValueError, "duration"):
            assess_boundaries(candidate, [(1800, 2100)], tolerance_ms=750)


if __name__ == "__main__":
    unittest.main()
