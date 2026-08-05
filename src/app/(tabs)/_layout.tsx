import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform, StyleSheet, View } from 'react-native';

import { useQuranAudio } from '@/audio/AudioProvider';
import { AppSymbol } from '@/components/AppSymbol';
import { GlassSurface } from '@/components/GlassSurface';
import { PlayerBar } from '@/components/PlayerBar';
import { palette } from '@/theme/colors';
import { useAppPalette } from '@/theme/useAppPalette';

const adaptiveGreen =
  Platform.OS === 'ios'
    ? DynamicColorIOS({ light: palette.light.primary, dark: palette.dark.primary })
    : palette.light.primary;

function PlayerAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return <PlayerBar embedded compact={placement === 'inline'} />;
}

function WebTabs() {
  const colors = useAppPalette();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.webTabLabel,
        tabBarItemStyle: styles.webTabItem,
        tabBarStyle: styles.webTabBar,
        tabBarBackground: () => (
          <GlassSurface strength="thin" style={styles.webTabBackground} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <AppSymbol name="home" size={18} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="quran"
        options={{
          title: 'Read',
          tabBarIcon: ({ color }) => <AppSymbol name="book" size={18} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="listen"
        options={{
          title: 'Listen',
          tabBarIcon: ({ color }) => <AppSymbol name="headphones" size={18} tintColor={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <AppSymbol name="settings" size={18} tintColor={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabsLayout() {
  const { chapter } = useQuranAudio();

  if (Platform.OS === 'web') {
    return <WebTabs />;
  }

  return (
    <View style={styles.root}>
      <NativeTabs tintColor={adaptiveGreen} minimizeBehavior="onScrollDown">
        {Platform.OS === 'ios' && chapter ? (
          <NativeTabs.BottomAccessory>
            <PlayerAccessory />
          </NativeTabs.BottomAccessory>
        ) : null}
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
          <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="quran">
          <NativeTabs.Trigger.Icon sf={{ default: 'book.closed', selected: 'book.closed.fill' }} />
          <NativeTabs.Trigger.Label>Read</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="listen">
          <NativeTabs.Trigger.Icon sf={{ default: 'headphones', selected: 'headphones' }} />
          <NativeTabs.Trigger.Label>Listen</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
          <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webTabBar: {
    position: 'absolute',
    width: 344,
    left: '50%',
    marginLeft: -172,
    bottom: 18,
    height: 62,
    borderTopWidth: 0,
    borderRadius: 31,
    backgroundColor: 'transparent',
    paddingTop: 6,
    paddingBottom: 7,
    overflow: 'visible',
  },
  webTabBackground: { flex: 1, borderRadius: 31 },
  webTabItem: { borderRadius: 24 },
  webTabLabel: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
});