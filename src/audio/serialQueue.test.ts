import { enqueueSerial, type SerialQueue } from './serialQueue';

describe('serial operation queue', () => {
  it('runs overlapping operations in order without dropping either request', async () => {
    const queue: SerialQueue = { current: Promise.resolve() };
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueueSerial(queue, async () => {
      events.push('first:start');
      await firstGate;
      events.push('first:end');
    });
    const second = enqueueSerial(queue, async () => {
      events.push('second');
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(events).toEqual(['first:start']);
    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(['first:start', 'first:end', 'second']);
  });

  it('reports a failure and still runs the next queued operation', async () => {
    const queue: SerialQueue = { current: Promise.resolve() };
    const errors: string[] = [];
    const events: string[] = [];

    const failed = enqueueSerial(
      queue,
      async () => {
        throw new Error('failed');
      },
      (error) => errors.push(error instanceof Error ? error.message : 'unknown'),
    );
    const next = enqueueSerial(queue, async () => {
      events.push('next');
    });

    await Promise.all([failed, next]);
    expect(errors).toEqual(['failed']);
    expect(events).toEqual(['next']);
  });
});
