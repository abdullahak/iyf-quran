#!/usr/bin/env python3
"""Generate deterministic, tiny texture assets without external packages."""

from __future__ import annotations

import random
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "textures" / "fine-grain.png"
SIZE = 128
SEED = 29


def chunk(kind: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(">I", zlib.crc32(kind + payload) & 0xFFFFFFFF)
    )


def main() -> None:
    random.seed(SEED)
    scanlines = bytearray()
    for _ in range(SIZE):
        scanlines.append(0)
        for _ in range(SIZE):
            light = random.random() > 0.5
            value = random.randint(214, 244) if light else random.randint(12, 42)
            alpha = random.randint(7, 17)
            scanlines.extend((value, value, value, alpha))

    header = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
    png += chunk(b"IDAT", zlib.compress(bytes(scanlines), level=9))
    png += chunk(b"IEND", b"")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_bytes(png)
    print(f"Generated {OUTPUT} ({len(png):,} bytes)")


if __name__ == "__main__":
    main()
