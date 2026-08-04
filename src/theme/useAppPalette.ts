import { useColorScheme } from 'react-native';

import { palette } from './colors';

export function useAppPalette() {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
