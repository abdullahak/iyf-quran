import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran/400Regular';
import { useFonts } from '@expo-google-fonts/amiri-quran/useFonts';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioProvider } from '@/audio/AudioProvider';
import { OfflineAudioProvider } from '@/audio/OfflineAudioProvider';
import { BookmarksProvider } from '@/bookmarks/BookmarksProvider';
import { PlayerBar } from '@/components/PlayerBar';
import { ReaderSettingsProvider } from '@/reader/ReaderSettingsProvider';
import { palette } from '@/theme/colors';

void SplashScreen.preventAutoHideAsync();

function RootPlayerChrome() {
  const pathname = usePathname();
  const inTabs = pathname === '/' || pathname === '/quran' || pathname === '/listen';
  const insets = useSafeAreaInsets();

  if (pathname === '/player') return null;
  if (Platform.OS === 'ios' && inTabs) return null;

  let bottomOffset = Math.max(insets.bottom + 10, 18);
  if (inTabs) {
    bottomOffset = Platform.OS === 'web' ? 92 : insets.bottom + 72;
  }

  return <PlayerBar bottomOffset={bottomOffset} />;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const [fontsLoaded, fontError] = useFonts({ AmiriQuran_400Regular });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded]);

  if (!fontsLoaded && !fontError) return null;
  if (fontError) throw fontError;

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
    <SafeAreaProvider>
      <BookmarksProvider>
        <ReaderSettingsProvider>
          <OfflineAudioProvider>
            <AudioProvider>
              <ThemeProvider value={navigationTheme}>
                <View style={styles.root}>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="surah/[id]" />
                    <Stack.Screen name="bookmarks" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="player" options={{ presentation: 'fullScreenModal' }} />
                  </Stack>
                  <RootPlayerChrome />
                </View>
              </ThemeProvider>
            </AudioProvider>
          </OfflineAudioProvider>
        </ReaderSettingsProvider>
      </BookmarksProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });