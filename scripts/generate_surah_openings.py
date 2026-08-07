#!/usr/bin/env python3
"""Generate exact Medina-style Surah-opening PNGs from real artwork.

Frame and Bismillah template:
  The user-provided 1246×310 reference at assets/surah-openings/source-template.png.
  The untouched source remains archived separately; runtime copies are transparent masks.

Title calligraphy source:
  mushafdatabase/MushafDatabase-Ligature-Based-SVG, SVG V1.01
  commit ae5786ab08597f8123575dec4e774f1eca195e0f (open Sadaqa-e-Jaria license).

Only flattened PNGs are consumed by the app. No title or Bismillah is recreated
with live text, borders, or an SVG renderer at runtime.
"""

from __future__ import annotations

import argparse
import contextlib
import copy
import hashlib
import importlib
import io
import json
import re
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageOps

SOURCE_COMMIT = "ae5786ab08597f8123575dec4e774f1eca195e0f"
SOURCE_TEMPLATE = (
    "https://raw.githubusercontent.com/mushafdatabase/"
    "MushafDatabase-Ligature-Based-SVG/"
    f"{SOURCE_COMMIT}/SVG%20V1.01/{{page:03d}}.svg"
)
PAGE_PATTERN = re.compile(
    r"\{ page: (\d+), first: \[(\d+), (\d+)\], last: \[(\d+), (\d+)\] \},?"
)
TITLE_SEARCH_BOX = (430, 50, 820, 145)
TITLE_SAFE_BOX = (410, 42, 836, 148)
TITLE_ONLY_HEIGHT = 185
RENDER_WIDTH = 1536
TRANSPARENT_PAPER_THRESHOLD = 240


@contextlib.contextmanager
def svg_cache(configured: Path | None):
    if configured is not None:
        if configured.is_symlink():
            raise RuntimeError(f"Refusing symlink SVG cache directory: {configured}")
        configured.mkdir(mode=0o700, parents=True, exist_ok=True)
        if not configured.is_dir() or configured.stat().st_mode & 0o077:
            raise RuntimeError(f"SVG cache directory must be private (0700): {configured}")
        yield configured
        return

    with tempfile.TemporaryDirectory(prefix="iyf-mushaf-title-svg-") as temporary_dir:
        cache_dir = Path(temporary_dir)
        cache_dir.chmod(0o700)
        if cache_dir.is_symlink() or not cache_dir.is_dir():
            raise RuntimeError(f"Unsafe temporary SVG cache directory: {cache_dir}")
        yield cache_dir


def as_tint_mask(image: Image.Image) -> Image.Image:
    """Convert monochrome paper artwork into tintable transparent line art."""
    grayscale = ImageOps.grayscale(image.convert("RGB"))
    alpha_table = [
        0
        if pixel >= TRANSPARENT_PAPER_THRESHOLD
        else round((TRANSPARENT_PAPER_THRESHOLD - pixel) * 255 / TRANSPARENT_PAPER_THRESHOLD)
        for pixel in range(256)
    ]
    alpha = grayscale.point(alpha_table)
    output = Image.new("RGBA", image.size, (0, 0, 0, 0))
    output.putalpha(alpha)
    return output


def parse_page_boundaries(path: Path) -> list[tuple[int, tuple[int, int], tuple[int, int]]]:
    matches = PAGE_PATTERN.findall(path.read_text(encoding="utf-8"))
    boundaries = [
        (int(page), (int(first_surah), int(first_ayah)), (int(last_surah), int(last_ayah)))
        for page, first_surah, first_ayah, last_surah, last_ayah in matches
    ]
    if len(boundaries) != 604:
        raise RuntimeError(f"Expected 604 Medina page boundaries, found {len(boundaries)}")
    return boundaries


def starts_by_page(
    boundaries: list[tuple[int, tuple[int, int], tuple[int, int]]],
) -> dict[int, list[int]]:
    result: dict[int, list[int]] = {}
    for page, first, last in boundaries:
        starts = [surah for surah in range(first[0], last[0] + 1) if first <= (surah, 1) <= last]
        if starts:
            result[page] = starts
    flattened = [surah for starts in result.values() for surah in starts]
    if flattened != list(range(1, 115)):
        raise RuntimeError("Canonical page metadata did not resolve exactly Surahs 1–114 in order")
    return result


def trusted_source_hashes(
    manifest_path: Path,
    mapping: dict[int, list[int]],
) -> dict[int, str]:
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("titleSourceCommit") != SOURCE_COMMIT:
        raise RuntimeError(
            f"Trusted manifest titleSourceCommit must be pinned commit {SOURCE_COMMIT}"
        )
    openings = manifest.get("openings")
    if not isinstance(openings, dict):
        raise RuntimeError("Trusted manifest is missing openings identities")

    hashes: dict[int, str] = {}
    for page, surahs in mapping.items():
        for surah in surahs:
            item = openings.get(str(surah))
            if not isinstance(item, dict):
                raise RuntimeError(f"Trusted manifest is missing Surah {surah} identity")
            if item.get("page") != page:
                raise RuntimeError(f"Surah {surah}: manifest page must be {page}")
            expected_source = f"SVG V1.01/{page:03d}.svg"
            if item.get("titleSource") != expected_source:
                raise RuntimeError(
                    f"Surah {surah}: titleSource must be {expected_source}"
                )
            source_hash = item.get("titleSourceSha256")
            if not isinstance(source_hash, str) or re.fullmatch(r"[0-9a-f]{64}", source_hash) is None:
                raise RuntimeError(f"Surah {surah}: missing or invalid titleSourceSha256")
            previous_hash = hashes.setdefault(page, source_hash)
            if previous_hash != source_hash:
                raise RuntimeError(f"Page {page}: inconsistent titleSourceSha256 identities")
    return hashes


def download_svg(page: int, cache_dir: Path, expected_sha256: str) -> bytes:
    if cache_dir.is_symlink():
        raise RuntimeError(f"Refusing symlink SVG cache directory: {cache_dir}")
    cache_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    if cache_dir.is_symlink() or not cache_dir.is_dir():
        raise RuntimeError(f"Unsafe SVG cache directory: {cache_dir}")
    output = cache_dir / f"{page:03d}.svg"
    if output.is_symlink():
        raise RuntimeError(f"Refusing symlink SVG cache file: {output}")
    request = urllib.request.Request(SOURCE_TEMPLATE.format(page=page), headers={"User-Agent": "iyf-quran-assets/1"})
    with urllib.request.urlopen(request, timeout=60) as response:
        downloaded = response.read()
    actual_sha256 = hashlib.sha256(downloaded).hexdigest()
    if actual_sha256 != expected_sha256:
        raise RuntimeError(
            f"Page {page}: downloaded SVG SHA-256 {actual_sha256} does not match trusted {expected_sha256}"
        )
    output.write_bytes(downloaded)
    return downloaded


def parse_svg(svg_bytes: bytes) -> Any:
    etree = importlib.import_module("lxml.etree")
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    return etree.fromstring(svg_bytes, parser=parser)


def load_svg_root(page: int, cache_dir: Path, expected_sha256: str) -> Any:
    return parse_svg(download_svg(page, cache_dir, expected_sha256))


def title_groups(root: Any) -> list[Any]:
    return root.xpath(".//*[local-name()='g' and @data-type='surah-name']")


def render_title(root: Any, group: Any) -> Image.Image:
    cairosvg = importlib.import_module("cairosvg")
    etree = importlib.import_module("lxml.etree")

    svg = etree.Element(
        "svg",
        nsmap={None: "http://www.w3.org/2000/svg"},
        version="1.1",
        viewBox=root.get("viewBox") or "0 0 382.68 547.09",
        preserveAspectRatio="xMidYMid meet",
    )
    svg.append(copy.deepcopy(group))
    png = cairosvg.svg2png(bytestring=etree.tostring(svg), output_width=RENDER_WIDTH)
    rendered = Image.open(io.BytesIO(png)).convert("RGBA")
    bbox = rendered.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Rendered title calligraphy is empty")
    return rendered.crop(bbox)


def reference_title_bbox(template: Image.Image) -> tuple[int, int, int, int]:
    region = ImageOps.grayscale(template.convert("RGB").crop(TITLE_SEARCH_BOX))

    def dark_pixel(pixel: int) -> int:
        return 255 if pixel < 120 else 0

    local = region.point(dark_pixel).getbbox()
    if local is None:
        raise RuntimeError("Could not locate the title embedded in the reference template")
    return (
        local[0] + TITLE_SEARCH_BOX[0],
        local[1] + TITLE_SEARCH_BOX[1],
        local[2] + TITLE_SEARCH_BOX[0],
        local[3] + TITLE_SEARCH_BOX[1],
    )


def replace_title(
    template: Image.Image,
    title: Image.Image,
    scale_x: float,
    scale_y: float,
) -> Image.Image:
    output = template.copy().convert("RGBA")
    draw = ImageDraw.Draw(output)
    draw.rectangle(TITLE_SAFE_BOX, fill=(246, 246, 246, 255))

    target_width = max(1, round(title.width * scale_x))
    target_height = max(1, round(title.height * scale_y))
    maximum_width = TITLE_SAFE_BOX[2] - TITLE_SAFE_BOX[0] - 12
    maximum_height = TITLE_SAFE_BOX[3] - TITLE_SAFE_BOX[1] - 8
    fit = min(1.0, maximum_width / target_width, maximum_height / target_height)
    target_width = max(1, round(target_width * fit))
    target_height = max(1, round(target_height * fit))
    resized = title.resize((target_width, target_height), Image.Resampling.LANCZOS)
    center_x = (TITLE_SAFE_BOX[0] + TITLE_SAFE_BOX[2]) // 2
    center_y = (TITLE_SAFE_BOX[1] + TITLE_SAFE_BOX[3]) // 2
    position = (center_x - target_width // 2, center_y - target_height // 2)
    output.alpha_composite(resized, position)
    return output


def write_typescript_map(output_path: Path, manifest: dict[str, dict[str, int | str]]) -> None:
    lines = [
        "// Generated by scripts/generate_surah_openings.py. Do not edit by hand.",
        "import type { ImageSourcePropType } from 'react-native';",
        "",
        "export const SURAH_OPENING_ASSETS: Readonly<Record<number, ImageSourcePropType>> = {",
    ]
    for chapter in range(1, 115):
        lines.append(f"  {chapter}: require('../../assets/surah-openings/{chapter:03d}.png'),")
    lines.extend([
        "};",
        "",
        "export const SURAH_OPENING_ASPECT_RATIOS: Readonly<Record<number, number>> = {",
    ])
    for chapter in range(1, 115):
        item = manifest[str(chapter)]
        ratio = int(item["width"]) / int(item["height"])
        lines.append(f"  {chapter}: {ratio:.8f},")
    lines.extend(["};", ""])
    output_path.write_text("\n".join(lines), encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=Path, default=Path("src/data/pages.ts"))
    parser.add_argument("--template", type=Path, default=Path("assets/surah-openings/source-template.png"))
    parser.add_argument("--svg-cache", type=Path)
    parser.add_argument(
        "--trusted-manifest",
        type=Path,
        default=Path("assets/surah-openings/manifest.json"),
    )
    parser.add_argument("--output-dir", type=Path, default=Path("assets/surah-openings"))
    parser.add_argument("--typescript-map", type=Path, default=Path("src/components/surahOpeningAssets.ts"))
    return parser


def main() -> None:
    args = build_argument_parser().parse_args()

    mapping = starts_by_page(parse_page_boundaries(args.pages))
    expected_hashes = trusted_source_hashes(args.trusted_manifest, mapping)
    template_bytes = args.template.read_bytes()
    template = Image.open(io.BytesIO(template_bytes)).convert("RGBA")
    if template.size != (1246, 310):
        raise RuntimeError(f"Expected the supplied 1246×310 template, found {template.size}")
    embedded_bbox = reference_title_bbox(template)
    args.output_dir.mkdir(parents=True, exist_ok=True)

    titles: dict[int, Image.Image] = {}
    sources: dict[int, tuple[int, str]] = {}
    with svg_cache(args.svg_cache) as cache_dir:
        for page, surahs in mapping.items():
            source_hash = expected_hashes[page]
            root = load_svg_root(page, cache_dir, source_hash)
            groups = title_groups(root)
            if len(groups) != len(surahs):
                raise RuntimeError(
                    f"Page {page}: canonical metadata has {len(surahs)} starts, SVG has {len(groups)} title groups"
                )
            for surah, group in zip(surahs, groups, strict=True):
                titles[surah] = render_title(root, group)
                sources[surah] = (page, source_hash)

    if set(titles) != set(range(1, 115)):
        raise RuntimeError(f"Expected 114 title artworks, found {len(titles)}")
    reference = titles[107]
    scale_x = (embedded_bbox[2] - embedded_bbox[0]) / reference.width
    scale_y = (embedded_bbox[3] - embedded_bbox[1]) / reference.height
    manifest: dict[str, dict[str, int | str]] = {}

    for surah in range(1, 115):
        title_only = surah in {1, 9}
        output_path = args.output_dir / f"{surah:03d}.png"
        if surah == 107:
            image = template.copy()
        else:
            image = replace_title(template, titles[surah], scale_x, scale_y)
        if title_only:
            image = image.crop((0, 0, image.width, TITLE_ONLY_HEIGHT))
        image = as_tint_mask(image)
        image.save(output_path, optimize=True, compress_level=9)
        if image.getbbox() is None:
            raise RuntimeError(f"Surah {surah} produced empty artwork")
        page, source_hash = sources[surah]
        manifest[str(surah)] = {
            "page": page,
            "width": image.width,
            "height": image.height,
            "titleSource": f"SVG V1.01/{page:03d}.svg",
            "titleSourceSha256": source_hash,
        }

    (args.output_dir / "manifest.json").write_text(
        json.dumps({
            "templateSha256": hashlib.sha256(template_bytes).hexdigest(),
            "titleSourceCommit": SOURCE_COMMIT,
            "runtimeTreatment": {
                "kind": "transparentTintMask",
                "paperThreshold": TRANSPARENT_PAPER_THRESHOLD,
            },
            "openings": manifest,
        }, indent=2) + "\n",
        encoding="utf-8",
    )
    write_typescript_map(args.typescript_map, manifest)
    print(f"Generated {len(manifest)} exact Surah opening PNGs in {args.output_dir}")


if __name__ == "__main__":
    main()
