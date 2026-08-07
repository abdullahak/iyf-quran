import { fireEvent, render, waitFor } from '@testing-library/react-native';

import AddToPlaylistScreen from '../app/add-to-playlist';
import BookmarksScreen from '../app/bookmarks';
import PlaylistScreen from '../app/playlist/[id]';

const mockAddRangeToPlaylist = jest.fn();
const mockCreatePlaylistWithRange = jest.fn();
const mockPlayQueue = jest.fn();
const mockPush = jest.fn();
const mockRemoveBookmark = jest.fn();
const mockReplace = jest.fn();
const mockReplaceQueue = jest.fn();
let mockParams: Record<string, string> = {};

const playlistItems = [
  { id: 'whole-surah', surah: 1, startAyah: 1, endAyah: 7 },
  { id: 'single-ayah', surah: 2, startAyah: 255, endAyah: 255 },
  { id: 'ayah-range', surah: 2, startAyah: 256, endAyah: 257 },
];

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({
    back: jest.fn(),
    canDismiss: () => false,
    canGoBack: () => false,
    dismiss: jest.fn(),
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock('@/audio/AudioProvider', () => ({
  useQuranAudio: () => ({ playQueue: mockPlayQueue }),
}));

jest.mock('@/audio/PlaybackLibraryProvider', () => ({
  usePlaybackLibrary: () => ({
    addRangeToPlaylist: mockAddRangeToPlaylist,
    createPlaylistWithRange: mockCreatePlaylistWithRange,
    playlists: [{
      id: 'study',
      name: 'Study',
      items: playlistItems,
    }],
    replaceQueue: mockReplaceQueue,
  }),
}));

jest.mock('@/bookmarks/BookmarksProvider', () => ({
  useBookmarks: () => ({
    bookmarks: [
      {
        target: { kind: 'surah', surah: 18, key: 'surah:18' },
        createdAt: 3,
      },
      {
        target: { kind: 'ayah', surah: 18, ayah: 10, key: '18:10' },
        createdAt: 2,
      },
      {
        target: {
          kind: 'range',
          surah: 18,
          startAyah: 10,
          endAyah: 16,
          key: 'range:18:10-16',
        },
        createdAt: 1,
      },
    ],
    ready: true,
    removeBookmark: mockRemoveBookmark,
  }),
}));

jest.mock('@/bookmarks/BookmarkPicker', () => ({ BookmarkPicker: () => null }));

jest.mock('@/i18n/useI18n', () => {
  const {
    formatLocalizedNumber,
    translate,
    translateCount,
  } = jest.requireActual('@/i18n/i18n');
  return {
    useI18n: () => ({
      isRTL: false,
      language: 'en',
      number: (value: number) => formatLocalizedNumber('en', value),
      t: (key: string, values?: Record<string, string | number>) => translate('en', key, values),
      tCount: (
        count: number,
        singularKey: string,
        pluralKey: string,
        values?: Record<string, string | number>,
      ) => translateCount('en', count, singularKey, pluralKey, values),
    }),
  };
});

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    background: '#fff',
    border: '#ddd',
    gold: '#a70',
    onPrimary: '#fff',
    primary: '#064',
    primarySoft: '#def',
    surface: '#fff',
    text: '#111',
    textFaint: '#777',
    textMuted: '#555',
  }),
}));

jest.mock('@/components/Atmosphere', () => ({ Atmosphere: () => null }));
jest.mock('@/components/AppSymbol', () => ({ AppSymbol: () => null }));
jest.mock('@/components/IconButton', () => {
  const { Pressable } = jest.requireActual('react-native');
  return {
    IconButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={label} onPress={onPress} />
    ),
  };
});

describe('playlist and bookmark range UX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'study' };
    mockPlayQueue.mockResolvedValue(true);
  });

  it.each([
    ['a whole Surah', { surah: '1' }, 'Surah 1', [1, 1, 7]],
    ['a single Ayah', { surah: '2', start: '255', end: '255' }, 'Ayah 255', [2, 255, 255]],
    ['an exact range', { surah: '2', start: '256', end: '257' }, 'Ayahs 256–257', [2, 256, 257]],
  ])('adds %s to an existing playlist with one exact action', async (
    _kind,
    params,
    visibleBounds,
    [surah, startAyah, endAyah],
  ) => {
    mockParams = params;
    const screen = await render(<AddToPlaylistScreen />);

    expect(screen.getByText(visibleBounds)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Add to Study'));

    expect(mockAddRangeToPlaylist).toHaveBeenCalledWith('study', surah, startAyah, endAyah);
  });

  it.each([
    ['a missing Surah', {}],
    ['a nonnumeric Surah', { surah: 'abc' }],
    ['a scientific-notation Surah', { surah: '2e0' }],
    ['a zero-padded Surah', { surah: '02' }],
    ['an unknown Surah', { surah: '0' }],
    ['a negative Ayah', { surah: '2', start: '-1', end: '2' }],
    ['a zero-padded Ayah', { surah: '2', start: '01', end: '2' }],
    ['a fractional Ayah', { surah: '2', start: '1.5', end: '2' }],
    ['a reversed range', { surah: '2', start: '5', end: '4' }],
    ['an Ayah beyond the Surah', { surah: '114', start: '1', end: '7' }],
  ])('fails closed for %s in an add-to-playlist route', async (_kind, params) => {
    mockParams = params;
    const screen = await render(<AddToPlaylistScreen />);

    expect(screen.getByText('This Quran selection is unavailable.')).toBeTruthy();
    expect(screen.queryByLabelText('Add to Study')).toBeNull();
    expect(mockAddRangeToPlaylist).not.toHaveBeenCalled();
    expect(mockCreatePlaylistWithRange).not.toHaveBeenCalled();
  });

  it('distinguishes whole-Surah, single-Ayah, and exact-range playlist items', async () => {
    const screen = await render(<PlaylistScreen />);

    expect(screen.getByText('Surah 1')).toBeTruthy();
    expect(screen.getByText('Ayah 255')).toBeTruthy();
    expect(screen.getByText('Ayahs 256–257')).toBeTruthy();
  });

  it('hands whole-Surah, single-Ayah, and range bounds unchanged to playback', async () => {
    const screen = await render(<PlaylistScreen />);

    fireEvent.press(screen.getByText('Play playlist'));

    await waitFor(() => expect(mockPlayQueue).toHaveBeenCalledWith(playlistItems));
    expect(mockPush).toHaveBeenCalledWith('/player');
  });

  it('distinguishes bookmark kinds and opens a range at its first Ayah', async () => {
    mockParams = {};
    const screen = await render(<BookmarksScreen />);

    expect(screen.getByText('Surah · Whole Surah · 110 ayahs')).toBeTruthy();
    expect(screen.getByText('Ayah · Ayah 10')).toBeTruthy();
    expect(screen.getByText('Ayah collection · Ayahs 10–16')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Open Al-Kahf, Ayahs 10–16'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/surah/[id]',
      params: { id: '18', ayah: '10' },
    });
  });
});
