declare const __dirname: string;
declare const require: (moduleName: string) => unknown;

const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string };
const { resolve } = require('path') as { resolve: (...paths: string[]) => string };

const tabsLayout = readFileSync(resolve(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');

describe('unified Quran tab navigation', () => {
  it('exposes one Quran destination and hides the legacy Listen route', () => {
    expect(tabsLayout).toContain("title: t('tabs.quran')");
    expect(tabsLayout).toContain("<NativeTabs.Trigger.Label>{t('tabs.quran')}</NativeTabs.Trigger.Label>");
    expect(tabsLayout).not.toContain('<NativeTabs.Trigger name="listen">');
    expect(tabsLayout).toMatch(/name="listen"\s+options=\{\{ href: null \}\}/);
  });
});
