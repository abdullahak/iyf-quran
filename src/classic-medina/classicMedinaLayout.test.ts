import { classicMedinaMetrics } from './classicMedinaLayout';

describe('Classic Medina fit-to-viewport layout', () => {
  it('fits all 15 physical rows in portrait and landscape', () => {
    const portrait = classicMedinaMetrics(390, 720);
    const landscape = classicMedinaMetrics(844, 300);

    expect(portrait.lineHeight * 15).toBeLessThanOrEqual(portrait.pageHeight);
    expect(landscape.lineHeight * 15).toBeLessThanOrEqual(landscape.pageHeight);
    expect(landscape.fontSize).toBeLessThan(portrait.fontSize);
    expect(landscape.lineHeight).toBeLessThan(portrait.lineHeight);
    expect(portrait.fontSize).toBeLessThanOrEqual(portrait.lineHeight * 0.57);
    expect(landscape.fontSize).toBeLessThanOrEqual(landscape.lineHeight * 0.57);
  });
});
