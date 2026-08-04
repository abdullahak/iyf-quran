#!/usr/bin/env python3
"""Transcribe a downloaded recitation track with word timestamps.

This is the first stage of the ayah alignment pipeline. Its JSON output is
kept under .cache/ and is reviewed before timestamps are published to the app.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path


def isolate_active_environment() -> None:
    """Ignore site-packages injected by a parent agent or shell environment."""
    active_prefix = Path(sys.prefix).resolve()
    sys.path[:] = [
        entry
        for entry in sys.path
        if not (
            "site-packages" in Path(entry).parts
            and not Path(entry).resolve().is_relative_to(active_prefix)
        )
    ]
    os.environ.pop("PYTHONPATH", None)


isolate_active_environment()

import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, GenerationConfig, pipeline

DEFAULT_MODEL = "tarteel-ai/whisper-base-ar-quran"
DEFAULT_GENERATION_CONFIG = "openai/whisper-base"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("surah", type=int)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--generation-config", default=DEFAULT_GENERATION_CONFIG)
    parser.add_argument(
        "--audio-dir", type=Path, default=Path(".cache/audio/muhammad-al-faqih")
    )
    parser.add_argument("--output-dir", type=Path, default=Path(".cache/alignment/raw"))
    args = parser.parse_args()

    if not 1 <= args.surah <= 114:
        raise ValueError("surah must be between 1 and 114")

    audio_path = args.audio_dir / f"{args.surah:03d}.mp3"
    if not audio_path.exists():
        raise FileNotFoundError(audio_path)

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    dtype = torch.float16 if device == "mps" else torch.float32
    processor = AutoProcessor.from_pretrained(args.model)
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        args.model,
        dtype=dtype,
        low_cpu_mem_usage=True,
    ).to(device)
    # The Quran checkpoint predates generation_config.json. Reuse the matching
    # Whisper base timestamp/alignment-head configuration rather than guessing IDs.
    model.generation_config = GenerationConfig.from_pretrained(args.generation_config)
    recognizer = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        device=device,
        dtype=dtype,
    )
    result = recognizer(
        str(audio_path),
        return_timestamps="word",
        chunk_length_s=30,
        stride_length_s=5,
        generate_kwargs={"language": "ar", "task": "transcribe"},
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    output_path = args.output_dir / f"{args.surah:03d}.json"
    payload = {
        "surah": args.surah,
        "audio": str(audio_path),
        "model": args.model,
        "generationConfig": args.generation_config,
        "device": device,
        "transcription": result,
    }
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(output_path)
    print(result.get("text", ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
