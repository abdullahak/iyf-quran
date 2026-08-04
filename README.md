# IYF Quran

A modern family Quran app built with Expo development builds. IYF Quran is inspired by and preserves attribution to [QuranEngine](https://github.com/quran/quran-ios), while using a cross-platform TypeScript application architecture.

## Product direction

- Native iOS-first composition with Liquid Glass controls, a mineral reading canvas, restrained paper texture, and accessible material fallbacks
- Calm, minimalist Quran reading designed for the family of Imam Yahya
- Uthmani Arabic text with accessible English context
- Background recitation by Muhammad Al-Faqih
- Ayah-by-ayah highlighting driven by verified timing manifests
- Local Surah/Ayah bookmarks with direct return-to-reader navigation
- Planned offline reading, saved progress, and rights-approved audio downloads

## Development

```bash
npm install
npm run dev
```

This is an Expo development-build project, not an Expo Go-only app:

```bash
npm run ios
npm run android
```

Liquid Glass is provided by the native iOS 26 `GlassView` API. Older iOS versions and reduced-transparency mode use blur or opaque material fallbacks. Use an iOS development build—not the browser tracer—for final visual review.

## Quality gates

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npx expo-doctor
```

## Reciter corpus

MP3Quran publishes 114 surah-level Muhammad Al-Faqih recordings. Download the source corpus into the git-ignored project cache with:

```bash
npm run audio:download
npm run audio:index
```

The app streams from MP3Quran. `audio:index` verifies all downloaded SHA-256 hashes and probes exact track durations. Local corpus files and candidate timing artifacts are used only to generate and review Ayah indexes and are not committed. Validate a candidate with `npm run audio:validate -- <timing.json>`; add `--require-verified` for the production gate. Redistribution rights and production Ayah boundaries remain subject to independent review.

Generate a cache-only ElevenLabs forced-alignment candidate from the exact MP3 and a normalized copy of canonical Uthmani text with:

```bash
npm run audio:align:elevenlabs -- 1
```

The script reads `ELEVENLABS_API_KEY` or the macOS Keychain item named `IYF_ELEVENLABS_API_KEY`, sends the secret to curl through stdin rather than process arguments, and saves raw provider output under `.cache/alignment/elevenlabs/raw/`. It verifies the MP3 SHA-256 before upload, uses a per-Surah lock and durable uncertain-request marker to prevent accidental duplicate charges, refuses to repay for an existing raw response unless `--force` is explicit, and never changes the Quran text displayed in the app. Use `--reuse-raw` to regenerate a candidate without another API call. Provider output remains `candidate` with zero calibrated confidence until the pilot's anomaly thresholds and independent checks are established. Audio before the first provider-aligned token is recorded as `leadingUnassigned`, never inferred to be silence without acoustic evidence.

Rank pilot outliers without converting provider loss into a false probability with:

```bash
npm run audio:analyze-pilot -- .cache/alignment/elevenlabs/candidates/*.json
```

The generated ignored-cache report independently matches every candidate to `.cache/alignment/track-index.json` and `.cache/alignment/canonical/`, preserves each audio and canonical-text SHA-256 in `corpusIdentities`, and only then ranks high alignment loss, high worst-word loss, unusual duration per canonical word, and provider words collapsed to 10 ms or less. Collapsed words are an explicit corpus-mismatch/pathology queue; these are anomaly-review inputs, not publication approval.

Add non-authoritative acoustic support with `npm run audio:analyze-silence -- <candidate...>`. The report records boundaries near FFmpeg-detected silence ends and flags starts that fall inside detected silence. Connected recitation often has no pause, so lack of silence is never treated as automatic rejection.

Audition and review a structurally valid candidate against its exact hash-locked MP3 with:

```bash
npm run audio:review -- .cache/alignment/candidates/001.json
```

The local reviewer serves canonical Arabic beside each boundary, supports transition/Ayah playback, millisecond nudging, direct playhead capture, keyboard review, range-seeking for long tracks, and atomic saves. It never publishes candidate data into the app.

If forced alignment compresses supplied canonical words to near-zero duration, treat the affected Surah as blocked until targeted transcription and human audio review establish whether the provider lost the path or the recording omits material. Do not repair an omitted Ayah by inventing a boundary.

After every Ayah has been independently verified, publish the index through the strict gate:

```bash
npm run audio:publish -- .cache/alignment/candidates/001.json
```

The reviewer saves the timing file in place; eligibility comes from the file's review statuses rather than its working-directory name. The publisher revalidates the canonical Ayah sequence, duration, exact MP3 hash, and every review status before generating the static Expo timing registry. Candidate or partially reviewed files are rejected without creating runtime data.

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for data, font, source-code, and audio attribution.
