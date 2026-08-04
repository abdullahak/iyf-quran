import { SymbolView, type AndroidSymbol, type SFSymbol, type SymbolViewProps } from 'expo-symbols';

export type AppSymbolName =
  | 'back'
  | 'forward'
  | 'play'
  | 'pause'
  | 'open'
  | 'book'
  | 'headphones'
  | 'search'
  | 'waveform'
  | 'wifiError'
  | 'home'
  | 'bookmark'
  | 'bookmarkFilled'
  | 'add'
  | 'close';

const symbols: Record<
  AppSymbolName,
  { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }
> = {
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  forward: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  open: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
  book: { ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' },
  headphones: { ios: 'headphones', android: 'headphones', web: 'headphones' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  waveform: { ios: 'waveform', android: 'graphic_eq', web: 'graphic_eq' },
  wifiError: { ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' },
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  bookmark: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' },
  add: { ios: 'plus', android: 'add', web: 'add' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
};

type Props = Omit<SymbolViewProps, 'name'> & {
  name: AppSymbolName;
};

export function AppSymbol({ name, ...props }: Props) {
  return <SymbolView {...props} name={symbols[name]} />;
}
