import { fireEvent, render } from '@testing-library/react-native';

import PlayerScreen from '../app/player';

const mockSetPlaybackScope = jest.fn();
const mockDismissTo = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    canDismiss: () => false,
    canGoBack: () => false,
    dismiss: jest.fn(),
    dismissTo: mockDismissTo,
    push: mockPush,
    replace: jest.fn(),
  }),
}));

jest.mock('@/audio/AudioProvider', () => ({
  useQuranAudio: () => ({
    activeAyah: 1,
    canPlayNext: true,
    canPlayPrevious: false,
    chapter: {
      arabicName: 'سُورَةُ الْفَاتِحَةِ',
      englishName: 'Al-Faatiha',
      number: 1,
    },
    endRule: { kind: 'continuous' },
    nextChapter: jest.fn(),
    playbackRate: 1,
    previousChapter: jest.fn(),
    reciter: {
      name: 'محمد الفقيه',
      supportsOffline: false,
    },
    seekTo: jest.fn(),
    setPlaybackRate: jest.fn(),
    setPlaybackScope: mockSetPlaybackScope,
    setSleepTimer: jest.fn(),
    sourceKind: 'streaming',
    status: { currentTime: 15, duration: 120, playing: false },
    toggle: jest.fn(),
  }),
}));

jest.mock('@/audio/OfflineAudioProvider', () => ({
  useOfflineAudio: () => ({
    cancelDownload: jest.fn(),
    downloadSurahs: jest.fn(),
    errors: {},
    progress: {},
    records: {},
    removeDownload: jest.fn(),
  }),
}));

jest.mock('@/audio/PlaybackLibraryProvider', () => ({
  usePlaybackLibrary: () => ({
    enqueueRange: jest.fn(),
    queue: [],
  }),
}));

jest.mock('@/i18n/useI18n', () => {
  const { formatLocalizedNumber, translate } = jest.requireActual('@/i18n/i18n');
  return {
    useI18n: () => ({
      isRTL: true,
      language: 'ar',
      number: (value: number) => formatLocalizedNumber('ar', value),
      t: (key: string, values?: Record<string, string | number>) => translate('ar', key, values),
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

jest.mock('@/settings/AppSettingsProvider', () => ({
  useAppSettings: () => ({ settings: { readerMode: 'mushaf' } }),
}));

jest.mock('@/components/AppSymbol', () => ({ AppSymbol: () => null }));

describe('Arabic player content', () => {
  beforeEach(() => {
    mockDismissTo.mockReset();
    mockPush.mockReset();
    mockSetPlaybackScope.mockReset();
    mockSetPlaybackScope.mockResolvedValue(false);
  });

  it('opens the saved reading mode at the active Ayah', async () => {
    const screen = await render(<PlayerScreen />);

    fireEvent.press(screen.getByText('فتح القارئ'));

    expect(mockDismissTo).toHaveBeenCalledWith({
      pathname: '/mushaf/[page]',
      params: { page: '1', focus: '1:1' },
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('localizes seek actions, play-until choices, and synchronized-recitation feedback', async () => {
    const screen = await render(<PlayerScreen />);

    expect(screen.getByLabelText('موضع التلاوة').props.accessibilityActions).toEqual([
      { name: 'increment', label: 'التقديم ١٥ ثانية' },
      { name: 'decrement', label: 'الرجوع ١٥ ثانية' },
    ]);
    for (const label of ['نهاية القرآن', 'الصفحة', 'الجزء', 'السورة']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    await fireEvent.press(screen.getByText('نهاية القرآن'));
    expect(mockSetPlaybackScope).toHaveBeenCalledWith('quran');

    await fireEvent.press(screen.getByText('الصفحة'));

    expect(await screen.findByText('يتطلب موضع التوقف هذا تلاوة متزامنة للموضع الحالي.')).toBeTruthy();
  });
});
