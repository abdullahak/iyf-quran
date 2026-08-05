import { requireOptionalNativeModule } from 'expo';

import type { RemoteCommandConfiguration } from './remoteCommands';

type HeadsetCommand = 'next' | 'previous';
type HeadsetCommandEvent = { command: HeadsetCommand };
type HeadsetControlsNativeModule = {
  configure: (
    active: boolean,
    canPrevious: boolean,
    canNext: boolean,
    queueIndex: number,
    queueCount: number,
  ) => void;
  addListener: (
    eventName: 'onCommand',
    listener: (event: HeadsetCommandEvent) => void,
  ) => { remove: () => void };
};

const nativeModule = requireOptionalNativeModule<HeadsetControlsNativeModule>('HeadsetControls');

export function configureHeadsetControls(config: RemoteCommandConfiguration): void {
  nativeModule?.configure(
    config.active,
    config.canPrevious,
    config.canNext,
    config.queueIndex,
    config.queueCount,
  );
}

export function addHeadsetCommandListener(
  listener: (command: HeadsetCommand) => void,
): () => void {
  if (!nativeModule) return () => undefined;
  const subscription = nativeModule.addListener('onCommand', ({ command }) => listener(command));
  return () => subscription.remove();
}
