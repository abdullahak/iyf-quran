import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOfflineAudio } from '@/audio/OfflineAudioProvider';
import { formatOfflineAudioBytes, summarizeOfflineAudio } from '@/audio/offlineAudio';
import { AppSymbol } from '@/components/AppSymbol';
import { IconButton } from '@/components/IconButton';
import { chapterByNumber } from '@/data/chapters';
import { useI18n } from '@/i18n/useI18n';
import { useAppPalette } from '@/theme/useAppPalette';
import { radius } from '@/theme/tokens';

export default function DownloadsScreen() {
  const colors = useAppPalette();
  const { language, number: localizedNumber, t } = useI18n();
  const router = useRouter();
  const {
    cancelDownload,
    errors,
    progress,
    ready,
    records,
    removeDownload,
  } = useOfflineAudio();
  const summary = summarizeOfflineAudio(records);
  const activeSurahs = Object.entries(progress)
    .filter(([surah, value]) => value !== undefined && !records[Number(surah)])
    .map(([surah]) => Number(surah))
    .sort((left, right) => left - right);
  const close = () => (
    router.canGoBack()
      ? router.back()
      : router.replace('/(tabs)/settings')
  );
  const summaryText = summary.count === 0
    ? t('downloads.noneSummary')
    : summary.count === 1
      ? t('downloads.oneSummary', { size: formatOfflineAudioBytes(summary.totalBytes) })
      : t('downloads.summary', {
          count: localizedNumber(summary.count),
          size: formatOfflineAudioBytes(summary.totalBytes),
        });

  const confirmRemoveAll = () => {
    Alert.alert(
      t('downloads.confirmTitle'),
      t('downloads.confirmBody'),
      [
        { text: t('downloads.cancel'), style: 'cancel' },
        {
          text: t('downloads.removeAllConfirm'),
          style: 'destructive',
          onPress: () => {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            void Promise.all(summary.surahs.map((surah) => removeDownload(surah)));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={['top', 'right', 'bottom', 'left']}
      style={[styles.safe, { backgroundColor: colors.background }]}
    >
      <View style={styles.navigation}>
        <IconButton name="close" label={t('downloads.close')} onPress={close} />
        <Text accessibilityRole="header" style={[styles.navigationTitle, { color: colors.text }]}>{t('downloads.title')}</Text>
        <View style={styles.navigationEnd} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.primarySoft }]}>
              <AppSymbol name="downloaded" size={22} tintColor={colors.primary} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>{summaryText}</Text>
              <Text style={[styles.summaryDetail, { color: colors.textMuted }]}>{t('downloads.verifiedBody')}</Text>
            </View>
          </View>

          {activeSurahs.length > 0 ? (
            <DownloadSection title={t('downloads.inProgress')}>
              <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {activeSurahs.map((surah, index) => {
                  const chapter = chapterByNumber(surah);
                  if (!chapter) return null;
                  const percentage = Math.round((progress[surah] ?? 0) * 100);
                  return (
                    <View key={surah}>
                      <View style={styles.row}>
                        <View style={styles.rowCopy}>
                          <Text accessibilityLanguage="ar" style={[styles.arabicName, { color: colors.text }]}>{chapter.arabicName}</Text>
                          <Text style={[styles.rowDetail, { color: colors.textMuted }]}>{chapter.englishName}</Text>
                          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
                            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${percentage}%` }]} />
                          </View>
                        </View>
                        <Text accessibilityLiveRegion="polite" style={[styles.percentage, { color: colors.primary }]}>{percentage}%</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('downloads.cancelLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
                          onPress={() => {
                            void Haptics.selectionAsync();
                            void cancelDownload(surah);
                          }}
                          style={styles.rowAction}
                        >
                          <AppSymbol name="close" size={16} tintColor={colors.danger} />
                        </Pressable>
                      </View>
                      {errors[surah] ? <Text style={[styles.error, { color: colors.danger }]}>{errors[surah]}</Text> : null}
                      {index < activeSurahs.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                    </View>
                  );
                })}
              </View>
            </DownloadSection>
          ) : null}

          <DownloadSection title={t('downloads.available')}>
            {ready && summary.count === 0 ? (
              <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <AppSymbol name="download" size={24} tintColor={colors.textFaint} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('downloads.none')}</Text>
                <Text style={[styles.emptyDetail, { color: colors.textMuted }]}>{t('downloads.noneBody')}</Text>
              </View>
            ) : (
              <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {summary.surahs.map((surah, index) => {
                  const record = records[surah];
                  const chapter = chapterByNumber(surah);
                  if (!record || !chapter) return null;
                  return (
                    <View key={surah}>
                      <View style={styles.row}>
                        <View style={styles.rowCopy}>
                          <Text accessibilityLanguage="ar" style={[styles.arabicName, { color: colors.text }]}>{chapter.arabicName}</Text>
                          <Text style={[styles.rowDetail, { color: colors.textMuted }]}>{t('downloads.verified', { surah: chapter.englishName, size: formatOfflineAudioBytes(record.bytes) })}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t('downloads.removeLabel', { surah: language === 'ar' ? chapter.arabicName.replace(/^سُورَةُ\s*/, '') : chapter.englishName })}
                          onPress={() => {
                            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            void removeDownload(surah);
                          }}
                          style={styles.rowAction}
                        >
                          <AppSymbol name="trash" size={17} tintColor={colors.danger} />
                        </Pressable>
                      </View>
                      {errors[surah] ? <Text style={[styles.error, { color: colors.danger }]}>{errors[surah]}</Text> : null}
                      {index < summary.surahs.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                    </View>
                  );
                })}
              </View>
            )}
          </DownloadSection>

          {summary.count > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('downloads.removeAllLabel', { count: localizedNumber(summary.count) })}
              onPress={confirmRemoveAll}
              style={({ pressed }) => [styles.removeAll, { borderColor: colors.border, opacity: pressed ? 0.62 : 1 }]}
            >
              <AppSymbol name="trash" size={17} tintColor={colors.danger} />
              <Text style={[styles.removeAllText, { color: colors.danger }]}>{t('downloads.removeAll')}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DownloadSection({ children, title }: { children: React.ReactNode; title: string }) {
  const colors = useAppPalette();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navigation: { height: 58, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  navigationTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '600' },
  navigationEnd: { width: 44 },
  scrollContent: { paddingBottom: 40 },
  content: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 20 },
  summary: { minHeight: 90, marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: 16, flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1, marginStart: 13 },
  summaryTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  summaryDetail: { marginTop: 3, fontSize: 11, lineHeight: 16 },
  section: { marginTop: 26 },
  sectionTitle: { marginBottom: 9, marginStart: 4, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, overflow: 'hidden' },
  row: { minHeight: 76, paddingStart: 15, paddingEnd: 8, flexDirection: 'row', alignItems: 'center' },
  rowCopy: { flex: 1, paddingVertical: 11 },
  arabicName: { fontFamily: 'AmiriQuran_400Regular', fontSize: 18, lineHeight: 29, writingDirection: 'rtl' },
  rowDetail: { fontSize: 11, lineHeight: 16 },
  rowAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginStart: 15 },
  progressTrack: { width: '100%', height: 4, marginTop: 8, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  percentage: { width: 44, textAlign: 'center', fontSize: 12, lineHeight: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  error: { paddingHorizontal: 15, paddingBottom: 10, fontSize: 11, lineHeight: 16 },
  empty: { minHeight: 170, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 16, lineHeight: 21, fontWeight: '600' },
  emptyDetail: { maxWidth: 320, marginTop: 5, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  removeAll: { minHeight: 50, marginTop: 20, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  removeAllText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
