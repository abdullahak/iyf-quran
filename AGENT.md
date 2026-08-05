# IYF Quran Agent Guidance

## Product design contract

Every interface in this project must feel modern, minimalist, intuitive, and distinctly native to iOS.

- Use restrained Liquid Glass for navigation, floating controls, sheets, menus, and transient player chrome.
- Keep Quran and Mushaf reading surfaces calm, opaque, stable, and highly legible; never place scripture on blur or glass.
- Prefer native hierarchy, lists, segmented controls, symbols, haptics, safe-area behavior, and direct manipulation over webpage-style cards and dashboards.
- Use subtle mineral/paper texture only where it supports reverence and tactility.
- Avoid gradients, decorative marketing copy, excessive shadows, stacked rounded cards, fabricated progress, clutter, and dated chrome.
- Arabic content is visually dominant. English is limited to concise transliterated names and functional labels.
- Every action must have an obvious entry point, clear state, VoiceOver label, and undo/cancel path where appropriate.
- Design related capabilities as one coherent system: reading position, bookmarks, playback, queue, playlists, navigation, and settings all share canonical `surah:ayah` identity.
- Liquid Glass must degrade gracefully for Reduce Transparency, older iOS versions, Android, and web.

## Quran integrity

- Canonical Quran text is immutable and authoritative.
- Use canonical `surah:ayah` identity for bookmarks, recent pages, queue items, playlists, seeking, and deep links.
- Keep machine-aligned timings separate from human-verified data and fail anomalous Surahs closed to ordinary unsynchronized playback.
- Model Juz, page, Surah, and Mushaf navigation as canonical Ayah ranges.

## Engineering expectations

- Use strict TDD for domain behavior and bug fixes: RED, GREEN, REFACTOR.
- Read definitions and usages before editing; do not invent APIs or dependencies.
- Preserve the local Expo/CNG architecture and verify native changes with a fresh development build.
- Run tests, lint, typecheck, Expo export, Expo Doctor, dependency checks, and physical-device QA before release.
