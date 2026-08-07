const QURAN_API_BASE = 'https://api.quran.com/api/v4';
const QCF_V2_FONT_BASE = 'https://verses.quran.foundation/fonts/quran/hafs/v2/ttf';

export const CLASSIC_MEDINA_LINE_COUNT = 15;
export const CLASSIC_MEDINA_PAGE_COUNT = 604;

export type QcfV2PageRequest = {
  url: string;
  init: {
    headers: { Accept: 'application/json' };
  };
};

export type QcfV2Word = {
  verseKey: `${number}:${number}`;
  codeV2: string;
  lineNumber: number;
  pageNumber: number;
  charTypeName: string;
  /** Stable API order across all verses on the page. */
  sourceIndex: number;
};

export type QcfV2Line = {
  lineNumber: number;
  words: QcfV2Word[];
  /** QCF glyphs concatenated without inserted characters or reordering. */
  codeV2: string;
};

export type QcfV2Page = {
  pageNumber: number;
  words: QcfV2Word[];
  lines: QcfV2Line[];
  /** Contiguous empty rows before the first API word, used by Surah openings. */
  openingLineNumbers: number[];
  openings: { chapterNumber: number; lineNumbers: number[] }[];
};

type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type FetchPage = (url: string, init: QcfV2PageRequest['init']) => Promise<FetchResponse>;

function assertPageNumber(pageNumber: number): void {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > CLASSIC_MEDINA_PAGE_COUNT) {
    throw new RangeError(`Classic Medina page must be an integer from 1 to ${CLASSIC_MEDINA_PAGE_COUNT}.`);
  }
}

export function qcfV2PageRequest(pageNumber: number): QcfV2PageRequest {
  assertPageNumber(pageNumber);
  const query = new URLSearchParams({
    words: 'true',
    word_fields: 'code_v2,line_number,page_number',
    per_page: 'all',
    mushaf: '2',
    filter_page_words: 'true',
  });

  return {
    url: `${QURAN_API_BASE}/verses/by_page/${pageNumber}?${query.toString()}`,
    init: { headers: { Accept: 'application/json' } },
  };
}

export function qcfV2FontFamily(pageNumber: number): string {
  assertPageNumber(pageNumber);
  return `QCF_P${pageNumber}`;
}

export function qcfV2FontUrl(pageNumber: number): string {
  assertPageNumber(pageNumber);
  return `${QCF_V2_FONT_BASE}/p${pageNumber}.ttf`;
}

function malformed(detail: string): never {
  throw new Error(`Malformed QCF v2 page: ${detail}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function verseKeyFrom(value: unknown): `${number}:${number}` | undefined {
  if (typeof value !== 'string' || !/^[1-9]\d*:[1-9]\d*$/.test(value)) return undefined;
  return value as `${number}:${number}`;
}

export function groupQcfV2WordsIntoLines(words: readonly QcfV2Word[]): QcfV2Line[] {
  const lines: QcfV2Line[] = Array.from(
    { length: CLASSIC_MEDINA_LINE_COUNT },
    (_, index) => ({ lineNumber: index + 1, words: [], codeV2: '' }),
  );

  for (const word of words) {
    if (!Number.isInteger(word.lineNumber)
      || word.lineNumber < 1
      || word.lineNumber > CLASSIC_MEDINA_LINE_COUNT) {
      malformed(`word ${word.sourceIndex} has invalid line_number`);
    }
    const line = lines[word.lineNumber - 1];
    line.words.push(word);
    line.codeV2 += word.codeV2;
  }

  return lines;
}

export function parseQcfV2Page(payload: unknown, expectedPageNumber: number): QcfV2Page {
  assertPageNumber(expectedPageNumber);
  if (!isRecord(payload) || !Array.isArray(payload.verses) || payload.verses.length === 0) {
    malformed('verses must be a non-empty array');
  }

  const words: QcfV2Word[] = [];
  let previousLineNumber = 0;

  payload.verses.forEach((rawVerse, verseIndex) => {
    if (!isRecord(rawVerse) || !Array.isArray(rawVerse.words) || rawVerse.words.length === 0) {
      malformed(`verse ${verseIndex} must contain words`);
    }
    const verseVerseKey = verseKeyFrom(rawVerse.verse_key);

    rawVerse.words.forEach((rawWord, wordIndex) => {
      if (!isRecord(rawWord)) malformed(`verse ${verseIndex} word ${wordIndex} is not an object`);

      const wordVerseKey = verseKeyFrom(rawWord.verse_key);
      if (wordVerseKey && verseVerseKey && wordVerseKey !== verseVerseKey) {
        malformed(`verse ${verseIndex} word ${wordIndex} has conflicting verse_key`);
      }
      const verseKey = wordVerseKey ?? verseVerseKey;
      if (!verseKey) malformed(`verse ${verseIndex} word ${wordIndex} has invalid verse_key`);

      if (typeof rawWord.code_v2 !== 'string' || rawWord.code_v2.length === 0) {
        malformed(`verse ${verseIndex} word ${wordIndex} has invalid code_v2`);
      }
      if (!Number.isInteger(rawWord.line_number)
        || (rawWord.line_number as number) < 1
        || (rawWord.line_number as number) > CLASSIC_MEDINA_LINE_COUNT) {
        malformed(`verse ${verseIndex} word ${wordIndex} has invalid line_number`);
      }
      if (!Number.isInteger(rawWord.page_number)) {
        malformed(`verse ${verseIndex} word ${wordIndex} has invalid page_number`);
      }
      if (rawWord.page_number !== expectedPageNumber) {
        throw new Error(
          `QCF v2 page mismatch: expected page ${expectedPageNumber}, received ${String(rawWord.page_number)}.`,
        );
      }
      if (typeof rawWord.char_type_name !== 'string' || rawWord.char_type_name.length === 0) {
        malformed(`verse ${verseIndex} word ${wordIndex} has invalid char_type_name`);
      }

      const lineNumber = rawWord.line_number as number;
      if (lineNumber < previousLineNumber) {
        malformed(`verse ${verseIndex} word ${wordIndex} moves backwards from line ${previousLineNumber}`);
      }
      previousLineNumber = lineNumber;

      words.push({
        verseKey,
        codeV2: rawWord.code_v2,
        lineNumber,
        pageNumber: expectedPageNumber,
        charTypeName: rawWord.char_type_name,
        sourceIndex: words.length,
      });
    });
  });

  const lines = groupQcfV2WordsIntoLines(words);
  const firstPopulatedLine = lines.findIndex((line) => line.words.length > 0);
  if (firstPopulatedLine < 0) malformed('page contains no words');
  const openings: QcfV2Page['openings'] = [];
  let emptyLineNumbers: number[] = [];
  for (const line of lines) {
    if (line.words.length === 0) {
      emptyLineNumbers.push(line.lineNumber);
      continue;
    }
    if (emptyLineNumbers.length > 0) {
      const [chapterNumber, ayahNumber] = line.words[0].verseKey.split(':').map(Number);
      if (ayahNumber === 1) openings.push({ chapterNumber, lineNumbers: emptyLineNumbers });
      emptyLineNumbers = [];
    }
  }

  return {
    pageNumber: expectedPageNumber,
    words,
    lines,
    openingLineNumbers: lines.slice(0, firstPopulatedLine).map((line) => line.lineNumber),
    openings,
  };
}

export async function fetchQcfV2Page(
  pageNumber: number,
  fetchPage: FetchPage = globalThis.fetch as unknown as FetchPage,
): Promise<QcfV2Page> {
  const request = qcfV2PageRequest(pageNumber);
  const response = await fetchPage(request.url, request.init);
  if (!response.ok) {
    throw new Error(`QCF v2 page request failed with HTTP ${response.status}.`);
  }
  return parseQcfV2Page(await response.json(), pageNumber);
}
