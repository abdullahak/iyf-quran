export type AyahSelection = { startAyah: number; endAyah: number };

export function updateAyahSelection(
  current: AyahSelection | undefined,
  ayah: number,
): AyahSelection | undefined {
  if (!Number.isInteger(ayah) || ayah < 1) return current;
  if (!current) return { startAyah: ayah, endAyah: ayah };
  if (current.startAyah === ayah && current.endAyah === ayah) return undefined;
  return {
    startAyah: Math.min(current.startAyah, ayah),
    endAyah: Math.max(current.endAyah, ayah),
  };
}
