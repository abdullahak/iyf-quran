import { remoteCommandConfiguration } from './remoteCommands';

describe('remote command configuration', () => {
  it('disables queue commands without an active Surah', () => {
    expect(remoteCommandConfiguration(undefined)).toEqual({
      active: false,
      canPrevious: false,
      canNext: false,
      queueIndex: 0,
      queueCount: 114,
    });
  });

  it('describes the first Surah as the start of the canonical queue', () => {
    expect(remoteCommandConfiguration(1)).toEqual({
      active: true,
      canPrevious: false,
      canNext: true,
      queueIndex: 0,
      queueCount: 114,
    });
  });

  it('describes a middle Surah with both queue directions available', () => {
    expect(remoteCommandConfiguration(95)).toEqual({
      active: true,
      canPrevious: true,
      canNext: true,
      queueIndex: 94,
      queueCount: 114,
    });
  });

  it('describes the last Surah as the end of the canonical queue', () => {
    expect(remoteCommandConfiguration(114)).toEqual({
      active: true,
      canPrevious: true,
      canNext: false,
      queueIndex: 113,
      queueCount: 114,
    });
  });

  it('uses explicit user-queue boundaries when a playlist or queue is active', () => {
    expect(remoteCommandConfiguration(57, { index: 0, count: 2 })).toEqual({
      active: true,
      canPrevious: false,
      canNext: true,
      queueIndex: 0,
      queueCount: 2,
    });
    expect(remoteCommandConfiguration(57, { index: 1, count: 2 })).toEqual({
      active: true,
      canPrevious: true,
      canNext: false,
      queueIndex: 1,
      queueCount: 2,
    });
  });
});
