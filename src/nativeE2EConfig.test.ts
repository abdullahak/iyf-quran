declare const __dirname: string;
declare const require: (moduleName: string) => unknown;

const { readFileSync } = require('fs') as { readFileSync: (path: string, encoding: string) => string };
const { resolve } = require('path') as { resolve: (...paths: string[]) => string };

const repositoryRoot = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(repositoryRoot, path), 'utf8');

describe('remote native iOS E2E configuration', () => {
  it('builds an unsigned iOS Simulator app and records every Maestro flow', () => {
    const eas = JSON.parse(read('eas.json'));
    const workflow = read('.eas/workflows/e2e-test-ios.yml');

    expect(eas.build['e2e-test']).toMatchObject({
      withoutCredentials: true,
      ios: { simulator: true },
    });
    expect(workflow).toContain('profile: e2e-test');
    expect(workflow).toContain('EAS_NO_VCS: 1');
    expect(workflow).toContain('.maestro/launch.yml');
    expect(workflow).toContain('.maestro/mushaf-page-turn.yml');
    expect(workflow).toContain('.maestro/reading-mushaf-layout.yml');
    expect(workflow).toContain('.maestro/player-accessory-clearance.yml');
    expect(workflow).toContain('.maestro/quran-audio-reader-integration.yml');
    expect(workflow).toContain('record_screen: true');
  });

  it('covers physical forward, vertical protection, reverse, and rotation gestures', () => {
    const flow = read('.maestro/mushaf-page-turn.yml');

    expect(flow).toContain('^Classic Medina,.*');
    expect(flow).toContain('id: tab-quran');
    expect(flow).not.toContain("text: '^Read$|^قراءة$'");
    expect(flow).toContain('direction: LEFT');
    expect(flow).toContain('direction: UP');
    expect(flow).toContain('direction: RIGHT');
    expect(flow).toContain("visible: '^Page 2$|^الصفحة ٢$'");
    expect(flow).toContain("visible: '^Page 1$|^الصفحة ١$'");
    expect(flow).toContain('setOrientation: LANDSCAPE_LEFT');

    const forwardSwipe = flow.indexOf('direction: RIGHT');
    const pageTwo = flow.indexOf("visible: '^Page 2$|^الصفحة ٢$'");
    const reverseSwipe = flow.indexOf('direction: LEFT', pageTwo);
    const pageOneAfterReverse = flow.indexOf("visible: '^Page 1$|^الصفحة ١$'", pageTwo);
    expect(forwardSwipe).toBeGreaterThan(-1);
    expect(forwardSwipe).toBeLessThan(pageTwo);
    expect(reverseSwipe).toBeGreaterThan(pageTwo);
    expect(reverseSwipe).toBeLessThan(pageOneAfterReverse);
  });

  it('opens the responsive Reading Mushaf surface in both orientations', () => {
    const flow = read('.maestro/reading-mushaf-layout.yml');

    expect(flow).toContain('^Reading Mushaf,.*');
    expect(flow).toContain('id: tab-quran');
    expect(flow).not.toContain("text: '^Read$|^قراءة$'");
    expect(flow).toContain('id: reading-mushaf-view');
    expect(flow).toContain('iyfquran://mushaf/48?focus=2%3A282');
    expect(flow).toContain("text: '^Open$'");
    expect(flow).toContain('reading-mushaf-section-2-282-282');
    expect(flow).toContain('reading-mushaf-section-2-1-.*');
    expect(flow).toContain('reading-mushaf-longest-ayah-portrait');
    expect(flow).toContain('reading-mushaf-longest-ayah-landscape');
    expect(flow).toContain('iyfquran://mushaf/50?focus=3%3A1');
    expect(flow).toContain('reading-mushaf-section-2-.*-286');
    expect(flow).toContain('reading-mushaf-section-3-1-.*');
    expect(flow).toContain('reading-mushaf-before-surah-3');
    expect(flow).toContain('reading-mushaf-surah-3-round-trip');
    expect(flow).toContain('setOrientation: LANDSCAPE_LEFT');
    expect(flow).toContain('setOrientation: PORTRAIT');
  });

  it('routes backward Reading Mushaf turns through an exact bounded responsive window', () => {
    const mushafScreen = read('src/app/mushaf/[page].tsx');

    expect(mushafScreen).toContain('previousResponsiveReadingPosition');
    expect(mushafScreen).toContain('immediatelyPreviousResponsiveReadingPosition');
    expect(mushafScreen).toContain('readingRouteForResponsiveWindow');
    expect(mushafScreen).toContain('initialPosition={responsiveInitialPosition}');
    expect(mushafScreen).toContain('onPreviousPage={openPreviousResponsiveWindow}');
    expect(mushafScreen).not.toContain('onPreviousPage={() => animateToPage(pageNumber - 1)}');
  });

  it('keeps the native player accessory clear of every tab destination', () => {
    const flow = read('.maestro/player-accessory-clearance.yml');
    const tabsLayout = read('src/app/(tabs)/_layout.tsx');

    expect(flow).toContain('id: tab-quran');
    expect(flow).toContain('id: play-surah-1');
    expect(flow).toContain('id: player-bar-content');
    expect(flow).toContain('id: tab-home');
    expect(flow).toContain('id: tab-settings');
    expect(flow).toContain('takeScreenshot: player-accessory-quran');
    expect(flow).toContain('takeScreenshot: player-accessory-home');
    expect(flow).toContain('takeScreenshot: player-accessory-settings');
    expect(tabsLayout).toContain('testID="tab-home"');
    expect(tabsLayout).toContain('testID="tab-quran"');
    expect(tabsLayout).toContain('testID="tab-settings"');
  });

  it('captures playback controls and the active Ayah inside Reading Mushaf', () => {
    const flow = read('.maestro/quran-audio-reader-integration.yml');

    expect(flow).toContain('id: play-surah-1');
    expect(flow).toContain('id: player-bar-content');
    expect(flow).toContain("assertVisible: 'Previous Surah|السورة السابقة'");
    expect(flow).toContain("assertVisible: 'Next Surah|السورة التالية'");
    expect(flow).toContain('direction: DOWN');
    expect(flow).toContain("text: 'Open Surah .* in the reader|فتح سورة .* في القارئ'");
    expect(flow).toContain('id: reading-mushaf-view');
    expect(flow).toContain('reading-mushaf-active-playback-highlight');
    expect(flow).toContain("tapOn: 'Close Mushaf page|إغلاق صفحة المصحف'");
    expect(flow).toContain("visible: '114 Surahs|١١٤ سورة'");
    expect(flow).toContain("assertNotVisible: 'NOW PLAYING|قيد التشغيل الآن'");
  });
});
