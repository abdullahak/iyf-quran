import { CHAPTERS } from '@/data/chapters';

import { normalizeQuranSearch } from './quranSearch';

describe('normalizeQuranSearch', () => {
  it('matches plain Arabic input against Uthmani chapter names', () => {
    const query = normalizeQuranSearch('الفاتحة');
    const source = normalizeQuranSearch(CHAPTERS[0].arabicName);

    expect(source).toContain(query);
  });

  it('normalizes common alif and alif maqsura variants', () => {
    expect(normalizeQuranSearch('إلى ٱلله')).toBe(normalizeQuranSearch('الي الله'));
  });
});
