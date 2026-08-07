import { fireEvent, render } from '@testing-library/react-native';

import { QuranSearchField } from './QuranSearchField';

jest.mock('@/i18n/useI18n', () => ({
  useI18n: () => ({
    t: (key: string) => ({
      'read.searchLabel': 'Search Surahs',
      'read.searchPlaceholder': 'Search Surah name or number',
    })[key] ?? key,
  }),
}));

jest.mock('@/theme/useAppPalette', () => ({
  useAppPalette: () => ({
    border: '#ccc',
    surface: '#fff',
    text: '#111',
    textFaint: '#888',
    textMuted: '#666',
  }),
}));

jest.mock('./AppSymbol', () => ({ AppSymbol: () => null }));

describe('QuranSearchField', () => {
  it('provides the shared localized Surah search interaction', async () => {
    const onChangeText = jest.fn();
    const screen = await render(
      <QuranSearchField value="" onChangeText={onChangeText} />,
    );

    const input = screen.getByLabelText('Search Surahs');
    expect(input.props.placeholder).toBe('Search Surah name or number');

    fireEvent.changeText(input, 'baqara');
    expect(onChangeText).toHaveBeenCalledWith('baqara');
  });
});
