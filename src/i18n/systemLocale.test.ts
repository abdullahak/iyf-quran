import { getSystemLanguageTag } from './systemLocale';

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'),
  requireOptionalNativeModule: () => null,
}));

describe('getSystemLanguageTag', () => {
  it('uses an available runtime locale when the native module is absent', () => {
    expect(
      getSystemLanguageTag({
        browserLanguageTags: [],
        intlLanguageTag: 'ar-SA',
      }),
    ).toBe('ar-SA');
  });

  it('uses the single runtime language when no language list exists', () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'en-US' },
    });

    try {
      expect(getSystemLanguageTag({ intlLanguageTag: 'ar-SA' })).toBe('en-US');
    } finally {
      if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
      } else {
        delete (globalThis as { navigator?: unknown }).navigator;
      }
    }
  });
});
