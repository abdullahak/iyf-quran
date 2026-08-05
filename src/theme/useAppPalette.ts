import { useAppSettings } from '@/settings/AppSettingsProvider';
import { palette } from './colors';

export function useAppPalette() {
  return useAppSettings().colorScheme === 'dark' ? palette.dark : palette.light;
}
