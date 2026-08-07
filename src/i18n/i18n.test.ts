import { formatLocalizedNumber, resolveLanguage, translate, translateCount } from './i18n';

describe('Arabic localization', () => {
  it('resolves explicit and system language choices safely', () => {
    expect(resolveLanguage('ar', 'en-US')).toBe('ar');
    expect(resolveLanguage('en', 'ar-SA')).toBe('en');
    expect(resolveLanguage('system', 'ar-SA')).toBe('ar');
    expect(resolveLanguage('system', 'fr-FR')).toBe('en');
  });

  it('translates navigation and player controls into Arabic', () => {
    expect(translate('en', 'tabs.quran')).toBe('Quran');
    expect(translate('ar', 'tabs.quran')).toBe('القرآن');
    expect(translate('ar', 'tabs.listen')).toBe('استماع');
    expect(translate('ar', 'browse.page')).toBe('صفحة');
    expect(translate('ar', 'player.open', { surah: 'البقرة' })).toBe('فتح مشغّل سورة البقرة');
  });

  it('names all three reading views in both languages', () => {
    expect(translate('en', 'settings.classicMedina')).toBe('Classic Medina');
    expect(translate('en', 'settings.readingMushaf')).toBe('Reading Mushaf');
    expect(translate('ar', 'settings.classicMedina')).toBe('مصحف المدينة الكلاسيكي');
    expect(translate('ar', 'settings.readingMushaf')).toBe('مصحف القراءة');
  });

  it('localizes contiguous Ayah selection actions', () => {
    expect(translate('en', 'common.selectedRange', { start: 2, end: 4 })).toBe('Ayahs 2–4 selected');
    expect(translate('ar', 'common.selectedRange', { start: '٢', end: '٤' })).toBe('تم تحديد الآيات ٢–٤');
    expect(translate('ar', 'common.select')).toBe('تحديد');
  });

  it('keeps the full Ayah count in whole-Surah Juz metadata', () => {
    expect(translate('en', 'common.ayahs', { count: '7' })).toBe('7 ayahs');
    expect(translate('ar', 'common.ayahs', { count: '٧' })).toBe('٧ آيات');
  });

  it('uses natural singular copy for every count-sensitive surface', () => {
    expect(translateCount('en', 1, 'read.oneResult', 'read.results')).toBe('1 result');
    expect(translateCount('en', 1, 'home.openPlaylistOne', 'home.openPlaylist', { name: 'Reflection' }))
      .toBe('Open playlist Reflection, 1 item');
    expect(translateCount('en', 1, 'home.oneItem', 'home.items')).toBe('1 item');
    expect(translateCount('en', 1, 'home.oneSavedPlace', 'home.savedPlaces')).toBe('1 saved place');
    expect(translateCount('en', 1, 'bookmarks.oneSavedPlace', 'bookmarks.savedPlaces')).toBe('1 saved place');
    expect(translateCount('en', 1, 'playlist.oneRange', 'playlist.ranges')).toBe('1 Quran range');
    expect(translateCount('en', 1, 'queue.oneMeta', 'queue.meta')).toBe('1 item · plays in order');
    expect(translateCount('en', 1, 'player.openQueueOne', 'player.openQueue')).toBe('Open queue with 1 item');

    expect(translateCount('ar', 1, 'read.oneResult', 'read.results')).toBe('نتيجة واحدة');
    expect(translateCount('ar', 1, 'home.openPlaylistOne', 'home.openPlaylist', { name: 'التدبر' }))
      .toBe('فتح قائمة التدبر، وبها عنصر واحد');
    expect(translateCount('ar', 1, 'home.oneSavedPlace', 'home.savedPlaces')).toBe('موضع محفوظ واحد');
    expect(translateCount('ar', 1, 'playlist.oneRange', 'playlist.ranges')).toBe('نطاق قرآني واحد');
    expect(translateCount('ar', 1, 'queue.oneMeta', 'queue.meta')).toBe('عنصر واحد · يُشغّل بالترتيب');
    expect(translateCount('ar', 1, 'player.openQueueOne', 'player.openQueue')).toBe('فتح قائمة التشغيل وفيها عنصر واحد');
  });

  it('uses Arabic-Indic numerals for Arabic UI metadata', () => {
    expect(formatLocalizedNumber('ar', 604)).toBe('٦٠٤');
    expect(formatLocalizedNumber('en', 604)).toBe('604');
  });

  it('localizes exact queue confirmation labels', () => {
    expect(translate('en', 'queue.addedRange', {
      surah: 'Al-Baqarah', start: '8', end: '10',
    })).toBe('Added Surah Al-Baqarah, Ayahs 8–10 to queue');
    expect(translate('ar', 'queue.addedAyah', {
      surah: 'البقرة', ayah: '٨',
    })).toBe('تمت إضافة سورة البقرة، الآية ٨ إلى قائمة التشغيل');
  });

  it('localizes invalid Quran playlist selections', () => {
    expect(translate('en', 'playlist.invalidSelection')).toBe('This Quran selection is unavailable.');
    expect(translate('ar', 'playlist.invalidSelection')).toBe('هذا التحديد القرآني غير متاح.');
  });
});
