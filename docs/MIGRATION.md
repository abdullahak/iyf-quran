# QuranEngine → IYF Quran migration map

IYF Quran is a new Expo/TypeScript implementation informed by the Apache-2.0 QuranEngine architecture. It is not a mechanical Swift conversion and does not copy the Quran.com example app UI.

## Architectural mapping

| QuranEngine | Responsibility | Expo implementation |
| --- | --- | --- |
| `Core` | platform-independent utilities and preferences | `src/theme`, shared hooks, and future `src/lib` modules |
| `Model` | Quran, text, annotation, and audio entities | `src/data`, `src/audio`, TypeScript domain types |
| `Data` | SQLite/CoreData/network abstractions | `src/services`, AsyncStorage cache; Expo SQLite/download storage in later phases |
| `Domain` | reading, translation, annotation, reciter, timing, and audio services | framework-light service modules and context providers |
| `UI/NoorUI` | design system and Quran typography | tokenized light/dark palette, Amiri Quran, reusable React Native components |
| `Features` | screens and application composition | Expo Router routes and route-local components |

The dependency direction remains the same: routes depend on components and domain services; domain services depend on data/types; data/types never import UI.

## Upstream behavior to preserve

The audit of QuranEngine `main` identifies these product capabilities:

- Surah and Juz navigation, recent/last reading positions, and reading bookmarks.
- Madani page-image and translated-text reading modes.
- Downloadable translations, Quran search, word text, and verse sharing.
- Page bookmarks, ayah bookmark collections, highlights, and notes.
- Optional Quran.com account synchronization through MobileSync.
- Gapless and per-ayah reciters, streaming and offline downloads.
- Audio ranges, verse/list repetition, verse/repetition delays, playback speed, previous/next ayah, and lock-screen state.
- Theme, reading, audio, and content settings.

The first tracer slice intentionally implements only the highest-risk path before broad parity: **surah catalog → Quran reader → Muhammad Al-Faqih playback → synchronized ayah state**.

## Audio compatibility model

QuranEngine supports two audio forms:

1. **Gapped**: one MP3 per ayah, named `{surah:03d}{ayah:03d}.mp3`.
2. **Gapless**: one MP3 per surah, named `{surah:03d}.mp3`, plus a timing database.

Its gapless database has a `timings(sura, ayah, time)` table, where `time` is milliseconds and ayah `999` marks the surah end. The player turns each start into an `AudioFrame`; the following ayah start (or surah end) supplies the frame end.

Muhammad Al-Faqih is available as 114 gapless surah MP3s, so IYF Quran uses the same conceptual model but publishes reviewable JSON. Each timing index is locked to the exact MP3 SHA-256 and stores Ayah starts rather than duplicating the corpus into per-Ayah files:

```json
{
  "schemaVersion": 1,
  "surah": 1,
  "audioSha256": "…",
  "durationMs": 12345,
  "reviewStatus": "candidate | reviewed | verified",
  "ayahs": [
    { "key": "1:1", "ayah": 1, "startMs": 0, "confidence": 0.98, "reviewStatus": "verified" }
  ]
}
```

The following Ayah start (or decoded track duration) supplies each Ayah end. A separate optional prelude segment records a non-numbered Basmala or independently reviewed leading silence. Provider-unaligned audio before the first token remains `leadingUnassigned`; alignment output alone must not label it silence. Only a complete index whose top-level status and every Ayah row are `verified` is enabled for seeking/highlighting. `compileVerifiedTimingIndex` rejects hash mismatches, missing Ayahs, invalid canonical keys, non-monotonic starts, and unreviewed data.

The production pipeline is:

1. Run `scripts/build_audio_index.py --verify-hashes` to probe duration and verify every local file against the download manifest.
2. Give ElevenLabs Forced Alignment the exact Surah MP3 plus a normalized alignment-only copy of canonical Uthmani text; preserve the source text and its SHA-256 separately.
3. Require the returned non-whitespace word sequence to exactly match the supplied sequence, and retain all raw character/word timestamps and losses under the ignored cache.
4. Aggregate the first aligned word of every canonical Ayah into hash-locked Ayah starts while keeping provider loss separate from calibrated confidence.
5. Detect a non-numbered Basmala/prelude separately for Surahs other than Al-Fatiha and At-Tawba.
6. Match every candidate against the independent track index and canonical transcript record, preserve both hashes in the pilot report, reject missing/repeated words structurally, then rank high provider loss, unusual duration per word, provider words collapsed to 10 ms or less, acoustic disagreement, and chapter-transition risks for anomaly review. A suspected recording omission blocks the whole Surah; never invent a boundary for absent material.
7. Audition flagged transitions plus a representative random sample in the local hash-locked reviewer; never describe machine output as human-verified.
8. Keep the existing verified-only publisher fail-closed until an explicit machine-aligned acceptance policy has independent-signal thresholds, sampling requirements, and a runtime fallback.

`npm run audio:publish -- <verified-timing.json>` enforces that final gate, sanitizes review-only evidence from the bundle, and regenerates the static Expo timing registry. The runtime recompiles every registered index against `src/audio/muhammadAlFaqihTracks.ts`; mismatched or malformed entries remain unavailable even if a generated registry is edited manually.

The current ignored-cache track index covers all 114 recordings, verifies all SHA-256 hashes, totals `2,156,930,882` bytes, and records `79,681,729` milliseconds of decoded duration. Forced alignment produced structurally valid candidates for 6,236 Ayahs, but machine evidence currently blocks Surahs 37, 43, 53, and 54 for five suspected omitted Ayahs pending human audio verification. Timing generation remains separate from this deterministic corpus index, and the production registry remains empty.

## Current tracer slice

Implemented:

- Expo SDK 57 development-build/CNG project with Expo Router and `expo-dev-client`.
- Native tab shell with modern Home, Quran, and Listen surfaces.
- Complete 114-surah metadata catalog and search.
- Uthmani Arabic reader with Saheeh International translation and local Al-Fatiha fallback.
- Amiri Quran typography, RTL Arabic, dynamic type-friendly layouts, light/dark palettes, and accessibility labels.
- Muhammad Al-Faqih as the featured Hafs reciter.
- `expo-audio` playback, background/lock-screen configuration, persistent cross-route player state, and seek primitives.
- A resumable full-corpus downloader and machine-readable source/checksum manifest under the git-ignored `.cache/` workspace.
- A hash-verified 114-track duration index produced by `scripts/build_audio_index.py`.
- A tested ElevenLabs forced-alignment candidate generator with Keychain support, exact canonical token matching, Basmala/prelude handling, raw-response reuse, duplicate-charge protection, collapsed-word detection, deterministic anomaly sampling, and FFmpeg silence support.
- A local timing reviewer with exact-MP3 range playback, canonical Arabic, boundary nudging, keyboard controls, structural validation, and atomic saves.
- Timing validation and active-ayah selection primitives with unit tests.
- Versioned local Surah/Ayah bookmarks with canonical keys, a native selection sheet, reader actions, and direct Ayah return navigation.

## Delivery phases

### Phase 1 — verified vertical slice

- Complete and manually verify Al-Fatiha boundaries from the structurally valid forced-alignment candidate.
- Enable ayah highlighting and per-ayah seeking for that chapter.
- Validate the iOS development build on a machine with Xcode Simulator runtimes.

### Phase 2 — Quran reading foundation

- Bundle a licensed offline Quran text database rather than depending on first-use network fetches.
- Add Juz/page navigation, reading position persistence, Arabic-only and translation modes, font sizing, and share actions.
- Add notes, highlights, and local search; migrate the existing bookmark repository to the chosen sync database without changing its domain model.

### Phase 3 — complete recitation

- Resolve or replace the four recordings with suspected omitted Ayahs before any timing publication for those Surahs.
- Review the deterministic sample, collapsed-word queue, high-loss queue, and long-surah boundaries, then publish only eligible Surahs in a versioned timing manifest.
- Add range playback, repeat/delay controls, speed, offline downloads, integrity checks, and storage management.

### Phase 4 — parity and sync

- Add translation downloads, advanced reading settings, Quran.com authentication/sync where API terms permit, localization, widgets/deep links, analytics/privacy choices, and release hardening.

## Licensing gates

- QuranEngine software: Apache-2.0; retain attribution and do not imply Quran.com endorsement.
- Quran text/translations: retain Al Quran Cloud/Tanzil/Quran Academy and translator attribution; never alter Quran text.
- Amiri Quran: SIL Open Font License 1.1.
- Muhammad Al-Faqih audio: the project owner represents it as public domain, but neither MP3Quran/Quran Central pages nor embedded file metadata contain a public-domain declaration. Obtain and archive explicit rights confirmation before bundling, mirroring, or publicly distributing the corpus. Streaming from the provider remains separately subject to its terms.
