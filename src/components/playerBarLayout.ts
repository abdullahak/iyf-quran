export const FLOATING_PLAYER_HEIGHT = 96;
export const PLAYER_CONTROL_GAP = 18;
export const NATIVE_TAB_BAR_CLEARANCE = 64;
export const PLAYER_TAB_GAP = 24;
export const PLAYER_TEXT_METRICS = {
  titleLineHeight: 32,
  metaLineHeight: 20,
} as const;

const DEFAULT_CONTROL_BOTTOM = 12;

export function floatingPlayerBottomOffset(safeAreaBottom: number): number {
  return Math.max(safeAreaBottom + 10, 18);
}

export function floatingTabPlayerBottomOffset(safeAreaBottom: number): number {
  return Math.max(0, safeAreaBottom) + NATIVE_TAB_BAR_CLEARANCE + PLAYER_TAB_GAP;
}

export function supportsNativeTabBottomAccessory(
  platform: string,
  version: string | number | undefined,
): boolean {
  if (platform !== 'ios' || version === undefined) return false;
  const majorVersion =
    typeof version === 'number' ? Math.floor(version) : Number.parseInt(version, 10);
  return Number.isFinite(majorVersion) && majorVersion >= 26;
}

export function bottomControlOffset(
  playerVisible: boolean,
  playerBottomOffset = DEFAULT_CONTROL_BOTTOM,
): number {
  if (!playerVisible) return Math.max(DEFAULT_CONTROL_BOTTOM, playerBottomOffset);
  return playerBottomOffset + FLOATING_PLAYER_HEIGHT + PLAYER_CONTROL_GAP;
}

export function readerScrollPadding(playerVisible: boolean, basePadding: number): number {
  if (!playerVisible) return basePadding;
  return basePadding + FLOATING_PLAYER_HEIGHT + PLAYER_CONTROL_GAP;
}
