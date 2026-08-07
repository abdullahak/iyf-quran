import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ChapterRow } from './ChapterRow';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn() }));
jest.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    language: 'en',
    number: (value: number) => String(value),
    t: (key: string) => key,
  }),
}));
jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    primary: '#064', primarySoft: '#def', text: '#111', textFaint: '#777', textMuted: '#555',
  }),
}));
jest.mock('./AppSymbol', () => ({ AppSymbol: () => null }));

describe('ChapterRow Arabic typography', () => {
  it('leaves enough vertical room for Amiri ascenders and harakat', async () => {
    const screen = await render(<ChapterRow chapter={{
      number: 1,
      arabicName: 'سُورَةُ ٱلْفَاتِحَةِ',
      englishName: 'Al-Fatiha',
      meaning: 'The Opening',
      ayahCount: 7,
      revelationType: 'Meccan',
    }} />);

    expect(StyleSheet.flatten(screen.getByText('ٱلْفَاتِحَةِ').props.style)).toMatchObject({
      lineHeight: 42,
      paddingTop: 4,
      paddingBottom: 2,
    });
  });
});
