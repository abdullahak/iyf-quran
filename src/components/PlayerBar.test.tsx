import { fireEvent, render } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { StyleSheet } from 'react-native';

import { PlayerBar } from './PlayerBar';


const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
}));

const mockSelectionAsync = jest.mocked(Haptics.selectionAsync);

jest.mock('@/audio/AudioProvider', () => ({
  useQuranAudio: () => ({
    canPlayNext: true,
    canPlayPrevious: true,
    chapter: {
      arabicName: 'سُورَةُ الْفَاتِحَةِ',
      englishName: 'Al-Fatiha',
    },
    nextChapter: jest.fn(),
    previousChapter: jest.fn(),
    reciter: { name: 'Muhammad Al-Faqih' },
    status: { currentTime: 0, duration: 100, playing: false },
    toggle: jest.fn(),
  }),
}));

jest.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    language: 'en',
    t: (key: string) => key === 'player.open' ? 'Open player' : key,
  }),
}));

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    primary: '#0a7',
    primarySoft: '#dfe',
    surfaceMuted: '#ddd',
    text: '#111',
    textMuted: '#666',
  }),
}));

jest.mock('./AppSymbol', () => ({ AppSymbol: () => null }));
jest.mock('./GlassSurface', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GlassSurface: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      React.createElement(View, props, children)
    ),
  };
});

describe('PlayerBar', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSelectionAsync.mockReset();
    mockSelectionAsync.mockResolvedValue(undefined);
  });

  it('fills the accessory height with a one-tap player trigger', async () => {
    const screen = await render(<PlayerBar embedded compact />);
    const trigger = screen.getByLabelText('Open player');

    expect(StyleSheet.flatten(trigger.props.style)).toMatchObject({
      alignSelf: 'stretch',
      justifyContent: 'center',
    });

    mockSelectionAsync.mockImplementation(() => new Promise(() => {}));
    fireEvent.press(trigger);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/player');
  });

  it('keeps the Arabic title to one line in the compact player', async () => {
    const screen = await render(<PlayerBar embedded compact />);

    expect(screen.getByText('الْفَاتِحَةِ').props.numberOfLines).toBe(1);
  });

  it('fits the inline accessory host instead of imposing an oversized minimum height', async () => {
    const screen = await render(<PlayerBar embedded compact />);

    expect(StyleSheet.flatten(screen.getByTestId('player-bar-content').props.style)).toMatchObject({
      height: '100%',
      minHeight: 0,
      alignItems: 'center',
    });
    expect(screen.queryByText('Al-Fatiha')).toBeNull();
    expect(screen.queryByLabelText('player.previous')).toBeNull();
    expect(screen.getByLabelText('player.play')).toBeTruthy();
    expect(screen.queryByLabelText('player.next')).toBeNull();
  });

  it('keeps every transport control in the same non-overlapping square tap target', async () => {
    const screen = await render(<PlayerBar embedded />);

    for (const label of ['player.previous', 'player.play', 'player.next']) {
      const control = screen.getByLabelText(label);

      expect(StyleSheet.flatten(control.props.style)).toMatchObject({
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
      });
      expect(control.props.hitSlop).toBeUndefined();
    }
  });
});
