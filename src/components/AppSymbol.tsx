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
  | 'close'
  | 'download'
  | 'downloaded'
  | 'fontDecrease'
  | 'fontIncrease'
  | 'next'
  | 'previous'
  | 'trash'
  | 'settings'
  | 'appearance'
  | 'check'
  | 'minus'
  | 'more'
  | 'queue'
  | 'timer'
  | 'speed';

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
  download: { ios: 'arrow.down.circle', android: 'download', web: 'download' },
  downloaded: { ios: 'checkmark.circle.fill', android: 'download_done', web: 'download_done' },
  fontDecrease: { ios: 'textformat.size.smaller', android: 'text_decrease', web: 'text_decrease' },
  fontIncrease: { ios: 'textformat.size.larger', android: 'text_increase', web: 'text_increase' },
  next: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' },
  previous: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  appearance: { ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  more: { ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' },
  queue: { ios: 'list.bullet', android: 'queue_music', web: 'queue_music' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  speed: { ios: 'speedometer', android: 'speed', web: 'speed' },
};

type Props = Omit<SymbolViewProps, 'name'> & {
  name: AppSymbolName;
};

export function AppSymbol({ name, ...props }: Props) {
  return <SymbolView {...props} name={symbols[name]} />;
}
