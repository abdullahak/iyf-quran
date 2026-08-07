import { updateAyahSelection } from './ayahSelection';

describe('contiguous Ayah selection', () => {
  it('starts, extends in either direction, and toggles a lone Ayah off', () => {
    expect(updateAyahSelection(undefined, 7)).toEqual({ startAyah: 7, endAyah: 7 });
    expect(updateAyahSelection({ startAyah: 7, endAyah: 7 }, 10)).toEqual({
      startAyah: 7,
      endAyah: 10,
    });
    expect(updateAyahSelection({ startAyah: 7, endAyah: 10 }, 4)).toEqual({
      startAyah: 4,
      endAyah: 10,
    });
    expect(updateAyahSelection({ startAyah: 7, endAyah: 7 }, 7)).toBeUndefined();
  });
});
