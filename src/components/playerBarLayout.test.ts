import {
  FLOATING_PLAYER_HEIGHT,
  PLAYER_TEXT_METRICS,
  bottomControlOffset,
  floatingPlayerBottomOffset,
  floatingTabPlayerBottomOffset,
  readerScrollPadding,
  supportsNativeTabBottomAccessory,
} from './playerBarLayout';

describe('compact player layout', () => {
  it('reserves enough height for two comfortable metadata lines', () => {
    expect(FLOATING_PLAYER_HEIGHT).toBeGreaterThanOrEqual(92);
    expect(PLAYER_TEXT_METRICS.titleLineHeight).toBeGreaterThanOrEqual(31);
    expect(PLAYER_TEXT_METRICS.metaLineHeight).toBeGreaterThanOrEqual(19);
  });

  it('moves bottom action controls fully above the floating player', () => {
    expect(bottomControlOffset(false)).toBe(12);
    expect(bottomControlOffset(false, 44)).toBe(44);
    expect(bottomControlOffset(true)).toBeGreaterThanOrEqual(FLOATING_PLAYER_HEIGHT + 30);
    const playerBottom = floatingPlayerBottomOffset(34);
    expect(playerBottom).toBe(44);
    expect(bottomControlOffset(true, playerBottom)).toBe(
      playerBottom + FLOATING_PLAYER_HEIGHT + 18,
    );
  });

  it('keeps the entire floating player visibly above the native tab bar', () => {
    expect(floatingTabPlayerBottomOffset(34)).toBe(122);
    expect(floatingTabPlayerBottomOffset(0)).toBe(88);
    expect(floatingTabPlayerBottomOffset(34)).toBeGreaterThan(
      floatingPlayerBottomOffset(34) + 70,
    );
  });

  it('uses the native tab accessory only where UIKit provides it', () => {
    expect(supportsNativeTabBottomAccessory('ios', '18.3')).toBe(false);
    expect(supportsNativeTabBottomAccessory('ios', 25)).toBe(false);
    expect(supportsNativeTabBottomAccessory('ios', '26.0')).toBe(true);
    expect(supportsNativeTabBottomAccessory('ios', 27)).toBe(true);
    expect(supportsNativeTabBottomAccessory('android', 36)).toBe(false);
    expect(supportsNativeTabBottomAccessory('web', undefined)).toBe(false);
  });

  it('reserves full player geometry below scrollable reader content', () => {
    expect(readerScrollPadding(false, 54)).toBe(54);
    expect(readerScrollPadding(true, 54)).toBeGreaterThanOrEqual(
      54 + FLOATING_PLAYER_HEIGHT + 18,
    );
    expect(readerScrollPadding(true, 150)).toBeGreaterThan(
      readerScrollPadding(false, 150),
    );
  });
});
