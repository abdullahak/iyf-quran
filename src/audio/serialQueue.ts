export type SerialQueue = {
  current: Promise<void>;
};

export function enqueueSerial(
  queue: SerialQueue,
  operation: () => Promise<void>,
  onError: (error: unknown) => void = () => undefined,
): Promise<void> {
  const run = queue.current
    .catch(() => undefined)
    .then(operation);
  const settled = run.catch((error: unknown) => {
    onError(error);
  });
  queue.current = settled;
  return settled;
}
