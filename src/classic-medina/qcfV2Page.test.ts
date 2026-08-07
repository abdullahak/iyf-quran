import {
  groupQcfV2WordsIntoLines,
  parseQcfV2Page,
  qcfV2FontUrl,
  qcfV2PageRequest,
  type QcfV2Word,
} from './qcfV2Page';

const glyph = (value: string, lineNumber: number, pageNumber = 50) => ({
  char_type_name: 'word',
  code_v2: value,
  line_number: lineNumber,
  page_number: pageNumber,
});

describe('qcfV2PageRequest', () => {
  it('requests every live QCF v2 word on the Hafs QCF v2 mushaf', () => {
    const request = qcfV2PageRequest(50);
    const url = new URL(request.url);

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://api.quran.com/api/v4/verses/by_page/50',
    );
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      words: 'true',
      word_fields: 'code_v2,line_number,page_number',
      per_page: 'all',
      mushaf: '2',
      filter_page_words: 'true',
    });
    expect(request.init).toEqual({
      headers: { Accept: 'application/json' },
    });
    expect(qcfV2FontUrl(50)).toBe(
      'https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p50.ttf',
    );
  });
});

describe('parseQcfV2Page', () => {
  it('preserves API glyph order and canonical verse identity', () => {
    const page = parseQcfV2Page({
      verses: [
        {
          verse_key: '2:10',
          words: [glyph('\uE001', 4), glyph('\uE002', 4)],
        },
        {
          verse_key: '2:11',
          words: [{ ...glyph('\uE003', 5), char_type_name: 'end' }],
        },
      ],
    }, 50);

    expect(page.words.map(({ verseKey, codeV2, charTypeName }) => ({
      verseKey,
      codeV2,
      charTypeName,
    }))).toEqual([
      { verseKey: '2:10', codeV2: '\uE001', charTypeName: 'word' },
      { verseKey: '2:10', codeV2: '\uE002', charTypeName: 'word' },
      { verseKey: '2:11', codeV2: '\uE003', charTypeName: 'end' },
    ]);
    expect(page.lines[3].codeV2).toBe('\uE001\uE002');
  });

  it('groups every page into exactly 15 numbered rows and identifies opening gaps', () => {
    const words: QcfV2Word[] = [
      {
        verseKey: '36:1',
        codeV2: '\uE101',
        lineNumber: 3,
        pageNumber: 440,
        charTypeName: 'word',
        sourceIndex: 0,
      },
      {
        verseKey: '36:1',
        codeV2: '\uE102',
        lineNumber: 15,
        pageNumber: 440,
        charTypeName: 'end',
        sourceIndex: 1,
      },
    ];

    const lines = groupQcfV2WordsIntoLines(words);

    expect(lines).toHaveLength(15);
    expect(lines.map((line) => line.lineNumber)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    ]);
    expect(lines[0].words).toEqual([]);
    expect(lines[1].words).toEqual([]);
    expect(lines[2].words).toEqual([words[0]]);
    expect(lines[14].words).toEqual([words[1]]);

    const page = parseQcfV2Page({
      verses: [{ verse_key: '36:1', words: [glyph('\uE101', 3, 440)] }],
    }, 440);
    expect(page.openingLineNumbers).toEqual([1, 2]);
  });

  it('identifies a Surah opening in the middle of a physical page', () => {
    const page = parseQcfV2Page({
      verses: [
        { verse_key: '4:176', words: [glyph('\uE001', 1, 106), glyph('\uE002', 5, 106)] },
        { verse_key: '5:1', words: [glyph('\uE003', 8, 106)] },
        { verse_key: '5:2', words: [glyph('\uE004', 10, 106)] },
      ],
    }, 106);

    expect(page.openings).toEqual([{ chapterNumber: 5, lineNumbers: [6, 7] }]);
  });

  it('rejects words whose page does not match the requested page', () => {
    expect(() => parseQcfV2Page({
      verses: [{ verse_key: '2:10', words: [glyph('\uE001', 4, 51)] }],
    }, 50)).toThrow('expected page 50');
  });

  it.each([
    ['missing verses', {}],
    ['bad verse identity', { verses: [{ verse_key: '2', words: [glyph('\uE001', 4)] }] }],
    ['missing glyph', { verses: [{ verse_key: '2:10', words: [{ ...glyph('', 4), code_v2: '' }] }] }],
    ['out-of-range line', { verses: [{ verse_key: '2:10', words: [glyph('\uE001', 16)] }] }],
    ['missing character type', { verses: [{ verse_key: '2:10', words: [{ ...glyph('\uE001', 4), char_type_name: null }] }] }],
  ])('rejects malformed payloads: %s', (_label, payload) => {
    expect(() => parseQcfV2Page(payload, 50)).toThrow(/Malformed QCF v2 page/);
  });
});
