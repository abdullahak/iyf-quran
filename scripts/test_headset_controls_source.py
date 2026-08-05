from __future__ import annotations

import unittest
from pathlib import Path


class HeadsetControlsSourceTests(unittest.TestCase):
    def test_preserves_absent_now_playing_metadata(self) -> None:
        source = (
            Path(__file__).resolve().parents[1]
            / "modules"
            / "headset-controls"
            / "ios"
            / "HeadsetControlsModule.swift"
        ).read_text(encoding="utf-8")

        self.assertNotIn("nowPlayingInfo ?? [:]", source)
        self.assertEqual(
            source.count(
                "if var nowPlayingInfo = nowPlayingInfoCenter.nowPlayingInfo"
            ),
            2,
        )
        self.assertIn(
            "nowPlayingInfoCenter.nowPlayingInfo = "
            "nowPlayingInfo.isEmpty ? nil : nowPlayingInfo",
            source,
        )


if __name__ == "__main__":
    unittest.main()
