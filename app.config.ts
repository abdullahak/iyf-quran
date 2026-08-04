import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'IYF Quran',
  slug: 'iyf-quran',
  owner: 'abdlh',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'iyfquran',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.abdlh.iyfquran',
    buildNumber: '1',
    supportsTablet: true,
    icon: './assets/images/icon.png',
    infoPlist: {
      CFBundleDisplayName: 'IYF Quran',
      ITSAppUsesNonExemptEncryption: false,
      LSApplicationCategoryType: 'public.app-category.reference',
    },
  },
  android: {
    package: 'com.abdlh.iyfquran',
    adaptiveIcon: {
      backgroundColor: '#123F36',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-audio',
      {
        microphonePermission: false,
        recordAudioAndroid: false,
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#123F36',
        image: './assets/images/splash-icon.png',
        imageWidth: 112,
        dark: {
          backgroundColor: '#081B17',
          image: './assets/images/splash-icon.png',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: 'cb17946e-1ae7-4d6d-8de2-43a216c611a8',
    },
  },
});
