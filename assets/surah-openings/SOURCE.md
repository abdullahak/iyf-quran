# Surah Opening Artwork Provenance

## Runtime assets

`001.png` through `114.png` are static, flattened transparent PNG masks consumed by the Expo app. The runtime applies the current theme's text color to these masks. It does not draw the Surah frame or Bismillah with SVG/native borders, and it does not render the Surah title or Bismillah as live text.

- The opaque `source-template.png` remains byte-for-byte identical to the user-provided 1246×310 reference image.
- `107.png` preserves that template's line-art geometry but converts near-white paper to transparent alpha so it can blend in light and dark themes.
- Other Surahs preserve the same frame and Bismillah geometry while replacing only the embedded title inside the central plaque, then receive the same deterministic transparency treatment.
- Surahs 1 and 9 are title-only: Fatiha's Bismillah remains Quranic Ayah 1 in the reader, and At-Tawbah has no opening Bismillah.

`manifest.json` records the runtime treatment as `transparentTintMask` with a paper threshold of `240`. Every bundled opening is verified to contain both fully transparent paper and fully opaque ink.

## Template

- File: `source-template.png`
- Supplied directly by the project owner in the Hermes conversation on 2026-08-05 for use in this app.
- Dimensions: 1246×310 px
- SHA-256: `222db5ad701856836f0cb3b5698b34c2d25bc4e3fd3c106cc4b0246fcc05004e`

## Title calligraphy

The title paths come from the exact Madinah Mushaf vector corpus:

- Repository: https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG
- Dataset: `SVG V1.01`
- Pinned commit: `ae5786ab08597f8123575dec4e774f1eca195e0f`
- License: open Sadaqa-e-Jaria permission; copied in `LICENSE-MUSHAFDATABASE.txt`

`manifest.json` records the source page and SHA-256 for each title.

## Regeneration

The generator downloads only pinned source SVGs into a new process-private `0700` temporary directory. It never trusts pre-existing cached bytes: every download must match the reviewed per-page SHA-256 identity in the committed `manifest.json` before the hardened XML parser sees it. Symlink cache paths are rejected. The temporary directory is removed after generation, then the generator writes PNG assets plus the Metro-safe static require map:

```bash
python3 -m venv /tmp/iyf-surah-art-venv
/tmp/iyf-surah-art-venv/bin/pip install cairosvg lxml pillow
DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/opt/cairo/lib:/opt/homebrew/lib \
  /tmp/iyf-surah-art-venv/bin/python -E scripts/generate_surah_openings.py
cd scripts && /tmp/iyf-surah-art-venv/bin/python -E -m unittest test_surah_openings.py
```

On macOS, CairoSVG requires the maintained Cairo library (`brew install cairo`).
