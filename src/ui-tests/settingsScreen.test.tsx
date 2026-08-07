import { fireEvent, render } from '@testing-library/react-native';

import SettingsScreen from '../app/(tabs)/settings';

const mockPush = jest.fn();
const mockSetLanguage = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
}));

jest.mock('@/audio/OfflineAudioProvider', () => ({
  useOfflineAudio: () => ({ records: {} }),
}));

jest.mock('@/reader/ReaderSettingsProvider', () => ({
  useReaderSettings: () => ({ fontScale: 1, setFontScale: jest.fn() }),
}));

jest.mock('@/settings/AppSettingsProvider', () => ({
  useAppSettings: () => ({
    settings: {
      appearance: 'system',
      language: 'en',
      readerMode: 'mushaf',
      reciterId: 'muhammad-al-faqih',
    },
    setAppearance: jest.fn(),
    setLanguage: mockSetLanguage,
    setReaderMode: jest.fn(),
    setReciterId: jest.fn(),
  }),
}));

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    background: '#fff',
    border: '#ddd',
    primary: '#064',
    primarySoft: '#def',
    surface: '#fff',
    surfaceMuted: '#eee',
    text: '#111',
    textFaint: '#777',
    textMuted: '#555',
  }),
}));

describe('Settings downloaded audio entry', () => {
  it('offers Ayah, exact Classic Medina, and responsive Reading Mushaf views', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('Ayah view')).toBeTruthy();
    expect(screen.getByText('Classic Medina')).toBeTruthy();
    expect(screen.getByText('Reading Mushaf')).toBeTruthy();
  });

  it('describes recitation as streaming while offline rights are unconfirmed', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('Hafs · synchronized Ayahs · streaming only')).toBeTruthy();
    expect(screen.getByText('Hafs · continuous streaming')).toBeTruthy();
    expect(screen.queryByText('Hafs · synchronized Ayahs · offline available')).toBeNull();
  });

  it('opens the downloaded-audio management flow with an honest empty summary', async () => {
    const screen = await render(<SettingsScreen />);

    expect(screen.getByText('Downloaded audio')).toBeTruthy();
    expect(screen.getByText('No Surahs downloaded')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Manage downloaded audio'));
    expect(mockPush).toHaveBeenCalledWith('/downloads');
  });

  it('persists an explicit Arabic interface choice', async () => {
    const screen = await render(<SettingsScreen />);

    await fireEvent.press(screen.getByLabelText('العربية'));
    expect(mockSetLanguage).toHaveBeenCalledWith('ar');
  });
});
