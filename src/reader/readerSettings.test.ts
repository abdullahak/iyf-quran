import {
  DEFAULT_READER_FONT_SCALE,
  nextReaderFontScale,
  parseReaderFontScale,
  READER_FONT_SCALES,
} from './readerSettings';

describe('reader font sizing', () => {
  it('uses five bounded readable steps', () => {
    expect(READER_FONT_SCALES).toEqual([0.85, 1, 1.15, 1.3, 1.45]);
    expect(nextReaderFontScale(1, 1)).toBe(1.15);
    expect(nextReaderFontScale(1, -1)).toBe(0.85);
    expect(nextReaderFontScale(1.45, 1)).toBe(1.45);
    expect(nextReaderFontScale(0.85, -1)).toBe(0.85);
  });

  it('restores only supported persisted values', () => {
    expect(parseReaderFontScale('1.3')).toBe(1.3);
    expect(parseReaderFontScale('99')).toBe(DEFAULT_READER_FONT_SCALE);
    expect(parseReaderFontScale('not-json')).toBe(DEFAULT_READER_FONT_SCALE);
    expect(parseReaderFontScale(null)).toBe(DEFAULT_READER_FONT_SCALE);
  });
});
