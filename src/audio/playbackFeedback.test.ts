import { Alert } from 'react-native';

import { playWithUnavailableFeedback } from './playbackFeedback';

describe('playWithUnavailableFeedback', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('shows an accessible explanation when exact playback cannot start', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await expect(playWithUnavailableFeedback(() => Promise.resolve(false))).resolves.toBe(false);

    expect(alert).toHaveBeenCalledWith(
      'Playback unavailable',
      'This Ayah or range is unavailable for the selected reciter or could not be started.',
    );
  });

  it('returns success without showing an alert when playback starts', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await expect(playWithUnavailableFeedback(() => Promise.resolve(true))).resolves.toBe(true);

    expect(alert).not.toHaveBeenCalled();
  });
});
