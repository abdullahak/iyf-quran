import { sha256Hex } from './fileIntegrity';

describe('audio file integrity', () => {
  it('computes the standard SHA-256 identity incrementally', () => {
    const encoder = new TextEncoder();
    expect(sha256Hex([encoder.encode('abc')])).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex([encoder.encode('a'), encoder.encode('b'), encoder.encode('c')])).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
