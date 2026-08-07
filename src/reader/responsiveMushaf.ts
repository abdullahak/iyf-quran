import { pageDeltaAfterSwipe } from './pageSwipe';

export type ResponsiveMushafAyah = {
  key: string;
  surah: number;
  ayah: number;
  arabic: string;
  marker?: string;
  startsSurah: boolean;
};

export const RESPONSIVE_MUSHAF_OPENING_LINE_COST = 1;

export type ResponsivePaginationBudget = {
  charsPerLine: number;
  lineCapacity: number;
  openingLineCost: number;
};

export type ResponsiveMushafTypography = ResponsivePaginationBudget & {
  fontSize: number;
  lineHeight: number;
};

export function responsiveMushafTypography(
  viewportWidth: number,
  availableHeight: number,
  fontScale: number,
): ResponsiveMushafTypography {
  const contentWidth = Math.min(620, Math.max(220, viewportWidth - 32));
  const fontSize = Math.max(20, Math.min(38, 26 * fontScale));
  const lineHeight = fontSize * 1.55;

  return {
    charsPerLine: Math.max(12, Math.floor(contentWidth / (fontSize * 0.38))),
    lineCapacity: Math.max(3, Math.floor((availableHeight - 24) / lineHeight)),
    openingLineCost: RESPONSIVE_MUSHAF_OPENING_LINE_COST,
    fontSize,
    lineHeight,
  };
}

export function responsiveMushafViewport(width: number, height: number) {
  return {
    height: Math.max(1, Math.floor(height)),
    width: Math.max(1, Math.floor(width)),
  };
}

export type ResponsiveMushafSwipeTarget =
  | { kind: 'screen'; index: number }
  | { kind: 'canonical'; direction: 'next' | 'previous' };

export function responsiveMushafScreenAfterSwipe(
  currentIndex: number,
  screenCount: number,
  dx: number,
  velocityX: number,
): ResponsiveMushafSwipeTarget | undefined {
  const delta = pageDeltaAfterSwipe(dx, velocityX);
  if (delta === undefined || screenCount < 1) return undefined;
  const targetIndex = currentIndex + delta;
  if (targetIndex < 0) return { kind: 'canonical', direction: 'previous' };
  if (targetIndex >= screenCount) return { kind: 'canonical', direction: 'next' };
  return { kind: 'screen', index: targetIndex };
}

function estimatedArabicGlyphCount(text: string): number {
  return Array.from(text.normalize('NFD'))
    .filter((character) => !/\p{Mark}/u.test(character))
    .length;
}

function estimatedAyahGlyphCount(ayah: ResponsiveMushafAyah): number {
  return estimatedArabicGlyphCount(`${ayah.arabic}${ayah.marker ?? ''}`);
}

export function responsiveMushafSectionLineCount(
  ayahs: readonly ResponsiveMushafAyah[],
  charsPerLine: number,
): number {
  const normalizedCharsPerLine = Math.max(1, Math.floor(charsPerLine));
  const glyphs = ayahs.reduce((sum, ayah) => sum + estimatedAyahGlyphCount(ayah), 0);
  return Math.max(1, Math.ceil(glyphs / normalizedCharsPerLine));
}

export function paginateResponsiveAyahs(
  ayahs: readonly ResponsiveMushafAyah[],
  budget: ResponsivePaginationBudget,
): ResponsiveMushafAyah[][] {
  const charsPerLine = Math.max(1, Math.floor(budget.charsPerLine));
  const lineCapacity = Math.max(1, Math.floor(budget.lineCapacity));
  const pages: ResponsiveMushafAyah[][] = [];
  let page: ResponsiveMushafAyah[] = [];
  let completedLines = 0;
  let currentSectionGlyphs = 0;

  const sectionLines = (glyphs: number) => Math.ceil(glyphs / charsPerLine);
  const currentLineCost = () => completedLines + sectionLines(currentSectionGlyphs);
  const startPageWith = (ayah: ResponsiveMushafAyah, glyphs: number) => {
    page = [ayah];
    completedLines = ayah.startsSurah ? Math.max(0, budget.openingLineCost) : 0;
    currentSectionGlyphs = glyphs;
  };

  for (const ayah of ayahs) {
    const glyphs = Math.max(1, estimatedAyahGlyphCount(ayah));
    const candidateCompletedLines = ayah.startsSurah
      ? completedLines + sectionLines(currentSectionGlyphs) + Math.max(0, budget.openingLineCost)
      : completedLines;
    const candidateSectionGlyphs = ayah.startsSurah
      ? glyphs
      : currentSectionGlyphs + glyphs;
    const candidateLineCost = candidateCompletedLines + sectionLines(candidateSectionGlyphs);

    if (page.length > 0 && candidateLineCost > lineCapacity) {
      pages.push(page);
      startPageWith(ayah, glyphs);
    } else if (page.length === 0) {
      startPageWith(ayah, glyphs);
    } else {
      page.push(ayah);
      completedLines = candidateCompletedLines;
      currentSectionGlyphs = candidateSectionGlyphs;
    }

    if (currentLineCost() >= lineCapacity) {
      pages.push(page);
      page = [];
      completedLines = 0;
      currentSectionGlyphs = 0;
    }
  }
  if (page.length > 0) pages.push(page);
  return pages;
}
