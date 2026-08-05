export const QURAN_REMOTE_QUEUE_COUNT = 114;

export type RemoteCommandConfiguration = {
  active: boolean;
  canPrevious: boolean;
  canNext: boolean;
  queueIndex: number;
  queueCount: number;
};

export type LogicalQueuePosition = {
  index: number;
  count: number;
};

export function remoteCommandConfiguration(
  surahNumber: number | undefined,
  queue?: LogicalQueuePosition,
): RemoteCommandConfiguration {
  const active = Number.isInteger(surahNumber)
    && surahNumber !== undefined
    && surahNumber >= 1
    && surahNumber <= QURAN_REMOTE_QUEUE_COUNT;
  const number = active ? surahNumber : undefined;
  const hasLogicalQueue = active
    && Number.isInteger(queue?.index)
    && Number.isInteger(queue?.count)
    && queue !== undefined
    && queue.count > 0
    && queue.index >= 0
    && queue.index < queue.count;
  if (hasLogicalQueue) {
    return {
      active: true,
      canPrevious: queue.index > 0,
      canNext: queue.index < queue.count - 1,
      queueIndex: queue.index,
      queueCount: queue.count,
    };
  }
  return {
    active,
    canPrevious: number !== undefined && number > 1,
    canNext: number !== undefined && number < QURAN_REMOTE_QUEUE_COUNT,
    queueIndex: number === undefined ? 0 : number - 1,
    queueCount: QURAN_REMOTE_QUEUE_COUNT,
  };
}
