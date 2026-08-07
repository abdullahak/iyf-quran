import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran/400Regular';
import { useFonts } from '@expo-google-fonts/amiri-quran/useFonts';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioProvider } from '@/audio/AudioProvider';
import { OfflineAudioProvider } from '@/audio/OfflineAudioProvider';
import { PlaybackLibraryProvider } from '@/audio/PlaybackLibraryProvider';
import { BookmarksProvider } from '@/bookmarks/BookmarksProvider';
import { PlayerBar } from '@/components/PlayerBar';
import { QueueConfirmationBanner } from '@/components/QueueConfirmationBanner';
import {
  floatingPlayerBottomOffset,
  floatingTabPlayerBottomOffset,
  supportsNativeTabBottomAccessory,
} from '@/components/playerBarLayout';
import { MUSHAF_PRESENTATION_OPTIONS } from '@/navigation/mushafPresentation';
import { PLAYER_PRESENTATION_OPTIONS } from '@/navigation/playerPresentation';
import { ReadingHistoryProvider } from '@/reader/ReadingHistoryProvider';
import { ReaderSettingsProvider } from '@/reader/ReaderSettingsProvider';
import { AppSettingsProvider, useAppSettings } from '@/settings/AppSettingsProvider';
import { palette } from '@/theme/colors';

void SplashScreen.preventAutoHideAsync();

function RootPlayerChrome() {
  const pathname = usePathname();
  const inTabs = pathname === '/' || pathname === '/quran' || pathname === '/listen' || pathname === '/settings';
  const insets = useSafeAreaInsets();
  const nativeTabAccessoryAvailable = supportsNativeTabBottomAccessory(
    Platform.OS,
    Platform.Version,
  );

  if (pathname === '/player') return null;
  if (inTabs && nativeTabAccessoryAvailable) return null;

  let bottomOffset = floatingPlayerBottomOffset(insets.bottom);
  if (inTabs) {
    bottomOffset = Platform.OS === 'web' ? 92 : floatingTabPlayerBottomOffset(insets.bottom);
  }

  return <PlayerBar bottomOffset={bottomOffset} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ AmiriQuran_400Regular });

  if (!fontsLoaded && !fontError) return null;
  if (fontError) throw fontError;

  return (
    <SafeAreaProvider>
      <AppSettingsProvider>
        <AppShell />
      </AppSettingsProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { colorScheme, isRTL, language, ready } = useAppSettings();

  useEffect(() => {
    if (!ready) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    }
    void SplashScreen.hideAsync();
  }, [isRTL, language, ready]);

  if (!ready) return null;
  const dark = colorScheme === 'dark';
  const colors = dark ? palette.dark : palette.light;
  const navigationTheme = dark
    ? {
        ...DarkTheme,
        colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface },
      }
    : {
        ...DefaultTheme,
        colors: { ...DefaultTheme.colors, background: colors.background, card: colors.surface },
      };

  return (
    <BookmarksProvider>
      <ReaderSettingsProvider>
        <ReadingHistoryProvider>
          <PlaybackLibraryProvider>
            <OfflineAudioProvider>
              <AudioProvider>
                <ThemeProvider value={navigationTheme}>
                  <View style={[styles.root, { direction: isRTL ? 'rtl' : 'ltr' }]}>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        contentStyle: { backgroundColor: colors.background },
                      }}
                    >
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="surah/[id]" />
                      <Stack.Screen name="mushaf/[page]" options={MUSHAF_PRESENTATION_OPTIONS} />
                      <Stack.Screen name="bookmarks" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="playlists" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="playlist/[id]" />
                      <Stack.Screen name="add-to-playlist" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="queue" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="downloads" options={{ presentation: 'modal' }} />
                      <Stack.Screen name="player" options={PLAYER_PRESENTATION_OPTIONS} />
                    </Stack>
                    <RootPlayerChrome />
                    <QueueConfirmationBanner />
                  </View>
                </ThemeProvider>
              </AudioProvider>
            </OfflineAudioProvider>
          </PlaybackLibraryProvider>
        </ReadingHistoryProvider>
      </ReaderSettingsProvider>
    </BookmarksProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });