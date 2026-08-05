import { File, FileMode } from 'expo-file-system';
import { sha256 } from 'js-sha256';

const HASH_CHUNK_BYTES = 1024 * 1024;

export function sha256Hex(chunks: Iterable<Uint8Array>): string {
  const hasher = sha256.create();
  for (const chunk of chunks) hasher.update(chunk);
  return hasher.hex();
}

export async function sha256File(uri: string): Promise<string> {
  const handle = new File(uri).open(FileMode.ReadOnly);
  const hasher = sha256.create();

  try {
    const size = handle.size;
    if (size === null) throw new Error('The downloaded file size is unavailable.');

    while ((handle.offset ?? 0) < size) {
      const remaining = size - (handle.offset ?? 0);
      const chunk = handle.readBytes(Math.min(HASH_CHUNK_BYTES, remaining));
      if (chunk.length === 0) throw new Error('The downloaded file ended before verification completed.');
      hasher.update(chunk);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }

    return hasher.hex();
  } finally {
    handle.close();
  }
}
