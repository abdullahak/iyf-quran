import { render } from '@testing-library/react-native';

import { QueueConfirmationBanner, queueConfirmationLabel } from './QueueConfirmationBanner';

const mockConfirmation = { id: 'range', surah: 2, startAyah: 8, endAyah: 10 };

jest.mock('@/audio/PlaybackLibraryProvider', () => ({
  usePlaybackLibrary: () => ({ enqueueConfirmation: mockConfirmation }),
}));

jest.mock('@/settings/AppSettingsProvider', () => ({
  useAppSettings: () => ({ language: 'en', isRTL: false, colorScheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 20, right: 0, bottom: 0, left: 0 }),
}));

describe('QueueConfirmationBanner', () => {
  it('formats whole Surahs, single Ayahs, and exact ranges', () => {
    expect(queueConfirmationLabel(
      { id: 'surah', surah: 1, startAyah: 1, endAyah: 7 },
      'en',
    )).toBe('Added Surah Al-Faatiha to queue');
    expect(queueConfirmationLabel(
      { id: 'ayah', surah: 2, startAyah: 8, endAyah: 8 },
      'ar',
    )).toContain('الآية ٨');
    expect(queueConfirmationLabel(mockConfirmation, 'en'))
      .toBe('Added Surah Al-Baqara, Ayahs 8–10 to queue');
  });

  it('renders one polite live alert with the localized exact range', async () => {
    const screen = await render(<QueueConfirmationBanner />);
    expect(screen.getByRole('alert')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByText('Added Surah Al-Baqara, Ayahs 8–10 to queue')).toBeTruthy();
  });
});
