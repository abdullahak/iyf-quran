import { fireEvent, render } from '@testing-library/react-native';

import QuranScreen from '../app/(tabs)/quran';

const mockPlayChapter = jest.fn();
const mockPlayQueue = jest.fn();
const mockPush = jest.fn();
const mockDownloadSurahs = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('@/audio/AudioProvider', () => ({
  useQuranAudio: () => ({
    chapter: undefined,
    playChapter: mockPlayChapter,
    playQueue: mockPlayQueue,
    reciter: { id: 'muhammad-al-faqih' },
    status: { playing: false },
    toggle: jest.fn(),
  }),
}));

jest.mock('@/audio/OfflineAudioProvider', () => ({
  useOfflineAudio: () => ({
    cancelDownload: jest.fn(),
    downloadSurahs: mockDownloadSurahs,
    errors: {},
    progress: {},
    records: {},
    removeDownload: jest.fn(),
  }),
}));

jest.mock('@/settings/AppSettingsProvider', () => ({
  useAppSettings: () => ({
    settings: { readerMode: 'ayah', reciterId: 'muhammad-al-faqih' },
  }),
}));

jest.mock('@/i18n/useI18n', () => {
  const { formatLocalizedNumber, translate } = jest.requireActual('@/i18n/i18n');
  return {
    useI18n: () => ({
      isRTL: false,
      language: 'en',
      number: (value: number) => formatLocalizedNumber('en', value),
      t: (key: string, values?: Record<string, string | number>) => translate('en', key, values),
      tCount: (
        count: number,
        one: string,
        many: string,
        values?: Record<string, string | number>,
      ) => translate('en', count === 1 ? one : many, { ...values, count }),
    }),
  };
});

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    background: '#fff',
    border: '#ddd',
    danger: '#900',
    onPrimary: '#fff',
    primary: '#064',
    primarySoft: '#def',
    surface: '#fff',
    surfaceMuted: '#eee',
    text: '#111',
    textFaint: '#777',
    textMuted: '#555',
  }),
}));

jest.mock('@/components/Atmosphere', () => ({ Atmosphere: () => null }));
jest.mock('@/components/AppSymbol', () => ({ AppSymbol: () => null }));

describe('unified Quran browsing', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockDownloadSurahs.mockReset();
    mockDownloadSurahs.mockResolvedValue(undefined);
    mockPlayChapter.mockClear();
    mockPlayQueue.mockReset();
    mockPlayQueue.mockResolvedValue(true);
  });

  it('lets a filtered result activate with one tap while the search keyboard is open', async () => {
    const screen = await render(<QuranScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search Surahs'), 'Ikhlaas');

    const list = screen.root!.queryAll((instance) => instance.type === 'RCTScrollView')[0];
    expect(list.props.keyboardShouldPersistTaps).toBe('handled');

    await fireEvent.press(screen.getByTestId('play-surah-112'));
    expect(mockPlayChapter).toHaveBeenCalledTimes(1);
    expect(mockPlayChapter).toHaveBeenCalledWith(expect.objectContaining({ number: 112 }));
  });

  it('opens reading from the same filtered Surah row', async () => {
    const screen = await render(<QuranScreen />);

    await fireEvent.changeText(screen.getByLabelText('Search Surahs'), 'Ikhlaas');
    await fireEvent.press(screen.getByLabelText(/^Open Surah Al-Ikhlaas/));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/surah/[id]',
      params: { id: '112', ayah: '1' },
    });
  });

  it('hides new download actions while offline redistribution rights are unconfirmed', async () => {
    const screen = await render(<QuranScreen />);

    expect(screen.queryByLabelText(/^Select Surah Al-Faatiha to download$/)).toBeNull();
    expect(screen.queryByText(/^Download 1/)).toBeNull();
    expect(mockDownloadSurahs).not.toHaveBeenCalled();
  });

  it('surfaces a visible live-region error when page playback cannot start', async () => {
    mockPlayQueue.mockResolvedValueOnce(false);
    const screen = await render(<QuranScreen />);

    await fireEvent.press(screen.getByText('Page'));
    await fireEvent.press(screen.getByText('Play page'));

    const error = await screen.findByText('Could not start this Quran selection. Try again.');
    expect(error.props.accessibilityLiveRegion).toBe('assertive');
    expect(mockPlayQueue).toHaveBeenCalledWith(expect.any(Array), 0);
  });
});
