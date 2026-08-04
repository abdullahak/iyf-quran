const arabicMarks = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function normalizeQuranSearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(arabicMarks, '')
    .replace(/[ٱآأإ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\u0640/g, '')
    .toLocaleLowerCase()
    .trim();
}
