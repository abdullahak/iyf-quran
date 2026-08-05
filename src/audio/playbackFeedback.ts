import { Alert } from 'react-native';

export async function playWithUnavailableFeedback(
  action: () => Promise<boolean>,
): Promise<boolean> {
  const started = await action();
  if (!started) {
    Alert.alert(
      'Playback unavailable',
      'This Ayah or range is unavailable for the selected reciter or could not be started.',
    );
  }
  return started;
}
