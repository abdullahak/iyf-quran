import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

import generate_surah_openings as generator


class TintMaskTests(unittest.TestCase):
    def test_white_becomes_transparent_and_ink_remains_visible(self) -> None:
        source = Image.new("RGB", (3, 1))
        source.putdata([(255, 255, 255), (128, 128, 128), (0, 0, 0)])

        result = generator.as_tint_mask(source)

        self.assertEqual(result.mode, "RGBA")
        self.assertEqual(result.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(result.getpixel((2, 0)), (0, 0, 0, 255))
        self.assertGreater(result.getpixel((1, 0))[3], 0)
        self.assertLess(result.getpixel((1, 0))[3], 255)

    def test_all_runtime_assets_have_transparent_paper_and_opaque_ink(self) -> None:
        asset_dir = Path(__file__).resolve().parents[1] / "assets" / "surah-openings"
        assets = sorted(asset_dir.glob("[0-9][0-9][0-9].png"))

        self.assertEqual(len(assets), 114)
        for path in assets:
            alpha_extrema = Image.open(path).convert("RGBA").getchannel("A").getextrema()
            self.assertEqual(alpha_extrema, (0, 255), path.name)

        manifest = json.loads((asset_dir / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(
            manifest["runtimeTreatment"],
            {"kind": "transparentTintMask", "paperThreshold": 240},
        )


class SourceIntegrityTests(unittest.TestCase):
    def test_stale_cache_never_bypasses_download(self) -> None:
        downloaded = b"<svg>fresh pinned source</svg>"
        expected_hash = hashlib.sha256(downloaded).hexdigest()

        with tempfile.TemporaryDirectory() as temporary_dir:
            cache_dir = Path(temporary_dir)
            cached_path = cache_dir / "001.svg"
            cached_path.write_bytes(b"stale or poisoned cache entry")

            with mock.patch.object(
                generator.urllib.request,
                "urlopen",
                return_value=io.BytesIO(downloaded),
            ) as urlopen:
                result = generator.download_svg(1, cache_dir, expected_hash)

            urlopen.assert_called_once()
            self.assertEqual(result, downloaded)
            self.assertEqual(cached_path.read_bytes(), downloaded)

    def test_only_freshly_downloaded_bytes_reach_svg_parser(self) -> None:
        downloaded = b"<svg data-source='fresh'/>"
        expected_hash = hashlib.sha256(downloaded).hexdigest()
        parsed_root = object()

        with tempfile.TemporaryDirectory() as temporary_dir:
            cache_dir = Path(temporary_dir)
            (cache_dir / "001.svg").write_bytes(b"not even valid XML")

            with (
                mock.patch.object(
                    generator.urllib.request,
                    "urlopen",
                    return_value=io.BytesIO(downloaded),
                ),
                mock.patch.object(
                    generator,
                    "parse_svg",
                    return_value=parsed_root,
                ) as parse_svg,
            ):
                result = generator.load_svg_root(1, cache_dir, expected_hash)

            self.assertIs(result, parsed_root)
            parse_svg.assert_called_once_with(downloaded)

    def test_hash_mismatch_fails_before_cache_replacement(self) -> None:
        trusted = b"<svg>reviewed source</svg>"
        downloaded = b"<svg>different source</svg>"
        expected_hash = hashlib.sha256(trusted).hexdigest()

        with tempfile.TemporaryDirectory() as temporary_dir:
            cache_dir = Path(temporary_dir)
            cached_path = cache_dir / "001.svg"
            cached_path.write_bytes(b"existing cache entry")

            with mock.patch.object(
                generator.urllib.request,
                "urlopen",
                return_value=io.BytesIO(downloaded),
            ):
                with self.assertRaisesRegex(RuntimeError, "SHA-256"):
                    generator.download_svg(1, cache_dir, expected_hash)

            self.assertEqual(cached_path.read_bytes(), b"existing cache entry")

    def test_symlink_cache_directory_is_rejected_before_download(self) -> None:
        downloaded = b"<svg>reviewed source</svg>"
        expected_hash = hashlib.sha256(downloaded).hexdigest()

        with tempfile.TemporaryDirectory() as temporary_dir:
            temporary_path = Path(temporary_dir)
            real_cache = temporary_path / "real-cache"
            real_cache.mkdir()
            cache_symlink = temporary_path / "cache-link"
            cache_symlink.symlink_to(real_cache, target_is_directory=True)

            with mock.patch.object(
                generator.urllib.request,
                "urlopen",
                return_value=io.BytesIO(downloaded),
            ) as urlopen:
                with self.assertRaisesRegex(RuntimeError, "symlink"):
                    generator.download_svg(1, cache_symlink, expected_hash)

            urlopen.assert_not_called()

    def test_symlink_cache_file_is_rejected_before_download(self) -> None:
        downloaded = b"<svg>reviewed source</svg>"
        expected_hash = hashlib.sha256(downloaded).hexdigest()

        with tempfile.TemporaryDirectory() as temporary_dir:
            temporary_path = Path(temporary_dir)
            cache_dir = temporary_path / "cache"
            cache_dir.mkdir()
            outside_target = temporary_path / "outside.svg"
            outside_target.write_bytes(b"must remain unchanged")
            (cache_dir / "001.svg").symlink_to(outside_target)

            with mock.patch.object(
                generator.urllib.request,
                "urlopen",
                return_value=io.BytesIO(downloaded),
            ) as urlopen:
                with self.assertRaisesRegex(RuntimeError, "symlink"):
                    generator.download_svg(1, cache_dir, expected_hash)

            urlopen.assert_not_called()
            self.assertEqual(outside_target.read_bytes(), b"must remain unchanged")

    def test_default_cache_is_new_private_temporary_directory(self) -> None:
        with generator.svg_cache(None) as first_cache:
            first_path = first_cache
            self.assertTrue(first_path.is_dir())
            self.assertFalse(first_path.is_symlink())
            self.assertEqual(first_path.stat().st_mode & 0o077, 0)

        self.assertFalse(first_path.exists())
        with generator.svg_cache(None) as second_cache:
            self.assertNotEqual(second_cache, first_path)

    def test_cli_default_does_not_select_a_shared_cache_path(self) -> None:
        args = generator.build_argument_parser().parse_args([])

        self.assertIsNone(args.svg_cache)

    def test_manifest_missing_source_hash_is_rejected(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        manifest_path = repository / "assets" / "surah-openings" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        del manifest["openings"]["1"]["titleSourceSha256"]
        mapping = generator.starts_by_page(
            generator.parse_page_boundaries(repository / "src" / "data" / "pages.ts")
        )

        with tempfile.TemporaryDirectory() as temporary_dir:
            altered_manifest = Path(temporary_dir) / "manifest.json"
            altered_manifest.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "titleSourceSha256"):
                generator.trusted_source_hashes(altered_manifest, mapping)

    def test_manifest_inconsistent_hashes_for_one_page_are_rejected(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        manifest_path = repository / "assets" / "surah-openings" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["openings"]["83"]["titleSourceSha256"] = "0" * 64
        mapping = generator.starts_by_page(
            generator.parse_page_boundaries(repository / "src" / "data" / "pages.ts")
        )

        with tempfile.TemporaryDirectory() as temporary_dir:
            altered_manifest = Path(temporary_dir) / "manifest.json"
            altered_manifest.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "inconsistent"):
                generator.trusted_source_hashes(altered_manifest, mapping)

    def test_manifest_commit_mismatch_is_rejected(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        manifest_path = repository / "assets" / "surah-openings" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["titleSourceCommit"] = "0" * 40
        mapping = generator.starts_by_page(
            generator.parse_page_boundaries(repository / "src" / "data" / "pages.ts")
        )

        with tempfile.TemporaryDirectory() as temporary_dir:
            altered_manifest = Path(temporary_dir) / "manifest.json"
            altered_manifest.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "titleSourceCommit"):
                generator.trusted_source_hashes(altered_manifest, mapping)

    def test_manifest_title_source_path_mismatch_is_rejected(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        manifest_path = repository / "assets" / "surah-openings" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["openings"]["1"]["titleSource"] = "SVG V1.01/002.svg"
        mapping = generator.starts_by_page(
            generator.parse_page_boundaries(repository / "src" / "data" / "pages.ts")
        )

        with tempfile.TemporaryDirectory() as temporary_dir:
            altered_manifest = Path(temporary_dir) / "manifest.json"
            altered_manifest.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "titleSource"):
                generator.trusted_source_hashes(altered_manifest, mapping)

    def test_manifest_page_mismatch_is_rejected(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        manifest_path = repository / "assets" / "surah-openings" / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["openings"]["1"]["page"] = 2
        mapping = generator.starts_by_page(
            generator.parse_page_boundaries(repository / "src" / "data" / "pages.ts")
        )

        with tempfile.TemporaryDirectory() as temporary_dir:
            altered_manifest = Path(temporary_dir) / "manifest.json"
            altered_manifest.write_text(json.dumps(manifest), encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "page"):
                generator.trusted_source_hashes(altered_manifest, mapping)


if __name__ == "__main__":
    unittest.main()
