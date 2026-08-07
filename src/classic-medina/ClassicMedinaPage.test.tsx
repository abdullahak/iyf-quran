import { render, waitFor } from '@testing-library/react-native';
import * as Font from 'expo-font';
import { StyleSheet } from 'react-native';

import { ClassicMedinaPage } from './ClassicMedinaPage';

jest.mock('expo-font', () => ({ loadAsync: jest.fn() }));

const mockLoadAsync = jest.mocked(Font.loadAsync);
const mockFetch = jest.fn();

const payload = {
  verses: [{
    verse_key: '2:10',
    words: [
      {
        char_type_name: 'word',
        code_v2: '\uE001',
        line_number: 1,
        page_number: 50,
      },
      {
        char_type_name: 'end',
        code_v2: '\uE002',
        line_number: 1,
        page_number: 50,
      },
    ],
  }],
};

describe('ClassicMedinaPage', () => {
  beforeEach(() => {
    mockLoadAsync.mockReset();
    mockLoadAsync.mockResolvedValue(undefined);
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as typeof fetch;
  });

  it('shows a loading state while the font and live page are pending', async () => {
    mockLoadAsync.mockImplementation(() => new Promise(() => {}));
    mockFetch.mockImplementation(() => new Promise(() => {}));

    const screen = await render(<ClassicMedinaPage pageNumber={50} />);

    expect(screen.getByTestId('classic-medina-loading')).toBeTruthy();
    expect(screen.queryAllByTestId(/classic-medina-line-/)).toHaveLength(0);
    await screen.unmount();
  });

  it('loads the page TTF and live page, then renders exactly 15 ordered rows', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const screen = await render(<ClassicMedinaPage pageNumber={50} />);

    await waitFor(() => expect(screen.getAllByTestId(/classic-medina-line-/)).toHaveLength(15));

    expect(mockLoadAsync).toHaveBeenCalledWith({
      QCF_P50: 'https://verses.quran.foundation/fonts/quran/hafs/v2/ttf/p50.ttf',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/verses/by_page/50?'),
      { headers: { Accept: 'application/json' } },
    );
    expect(screen.getAllByTestId(/classic-medina-line-/).map((row) => row.props.testID)).toEqual(
      Array.from({ length: 15 }, (_, index) => `classic-medina-line-${index + 1}`),
    );
    expect(screen.getByTestId('classic-medina-line-1').props.children).toBeTruthy();
    expect(screen.getByText('\uE001\uE002')).toBeTruthy();
    expect(screen.queryByTestId('classic-medina-loading')).toBeNull();
  });

  it('shows a stable error state when the live page cannot be loaded', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const screen = await render(<ClassicMedinaPage pageNumber={50} />);

    await waitFor(() => expect(screen.getByTestId('classic-medina-error')).toBeTruthy());
    expect(screen.getByText('Unable to load Classic Medina page 50.')).toBeTruthy();
    expect(screen.queryAllByTestId(/classic-medina-line-/)).toHaveLength(0);
  });

  it('uses the playback highlight for the active Ayah instead of a stale selection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const screen = await render(
      <ClassicMedinaPage
        active={{ surah: 2, ayah: 10 }}
        focused={{ surah: 2, ayah: 9 }}
        pageNumber={50}
      />,
    );

    await waitFor(() => expect(screen.getAllByTestId(/classic-medina-line-/)).toHaveLength(15));
    expect(StyleSheet.flatten(screen.getByTestId('classic-medina-word-0').props.style)).toMatchObject({
      backgroundColor: 'rgba(19, 113, 78, 0.28)',
    });
  });
});
