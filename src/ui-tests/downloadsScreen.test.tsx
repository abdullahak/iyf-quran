import { fireEvent, render } from '@testing-library/react-native';

import DownloadsScreen from '../app/downloads';

const mockCancelDownload = jest.fn();
const mockRemoveDownload = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: () => true,
    replace: jest.fn(),
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  NotificationFeedbackType: { Warning: 'warning' },
}));

jest.mock('@/i18n/useI18n', () => {
  const { formatLocalizedNumber, translate } = jest.requireActual('@/i18n/i18n');
  return {
    useI18n: () => ({
      isRTL: false,
      language: 'en',
      number: (value: number) => formatLocalizedNumber('en', value),
      t: (key: string, values?: Record<string, string | number>) => translate('en', key, values),
    }),
  };
});

jest.mock('@/audio/OfflineAudioProvider', () => ({
  useOfflineAudio: () => ({
    cancelDownload: mockCancelDownload,
    errors: {},
    progress: { 2: 0.4 },
    ready: true,
    records: {
      1: {
        surah: 1,
        uri: 'file:///cache/001.mp3',
        bytes: 9 * 1024 * 1024,
        sha256: 'hash',
        downloadedAt: '2026-08-04T00:00:00.000Z',
        verifiedAt: '2026-08-04T00:00:01.000Z',
      },
    },
    removeDownload: mockRemoveDownload,
  }),
}));

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    background: '#fff',
    border: '#ddd',
    danger: '#900',
    primary: '#064',
    primarySoft: '#def',
    surface: '#fff',
    surfaceMuted: '#eee',
    text: '#111',
    textFaint: '#777',
    textMuted: '#555',
  }),
}));

describe('Downloaded audio management', () => {
  it('shows completed and active downloads with working management actions', async () => {
    const screen = await render(<DownloadsScreen />);

    expect(screen.getByText('Downloaded audio')).toBeTruthy();
    expect(screen.getByText('1 Surah · 9 MB')).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Remove downloaded Surah Al-Faatiha'));
    expect(mockRemoveDownload).toHaveBeenCalledWith(1);

    await fireEvent.press(screen.getByLabelText('Cancel download of Surah Al-Baqara'));
    expect(mockCancelDownload).toHaveBeenCalledWith(2);
  });
});
