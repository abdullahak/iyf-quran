import ExpoModulesCore
import MediaPlayer

public final class HeadsetControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("HeadsetControls")
    Events("onCommand")

    Function("configure") { (
      active: Bool,
      canPrevious: Bool,
      canNext: Bool,
      queueIndex: Int,
      queueCount: Int
    ) in
      DispatchQueue.main.async {
        self.configureRemoteCommands(
          active: active,
          canPrevious: canPrevious,
          canNext: canNext,
          queueIndex: queueIndex,
          queueCount: queueCount
        )
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.removeRemoteCommands()
      }
    }
  }

  private func configureRemoteCommands(
    active: Bool,
    canPrevious: Bool,
    canNext: Bool,
    queueIndex: Int,
    queueCount: Int
  ) {
    guard active else {
      removeRemoteCommands()
      return
    }

    let commandCenter = MPRemoteCommandCenter.shared()
    if nextTarget == nil {
      nextTarget = commandCenter.nextTrackCommand.addTarget { [weak self] _ in
        guard let self else { return .commandFailed }
        self.sendEvent("onCommand", ["command": "next"])
        return .success
      }
    }
    if previousTarget == nil {
      previousTarget = commandCenter.previousTrackCommand.addTarget { [weak self] _ in
        guard let self else { return .commandFailed }
        self.sendEvent("onCommand", ["command": "previous"])
        return .success
      }
    }
    commandCenter.nextTrackCommand.isEnabled = canNext
    commandCenter.previousTrackCommand.isEnabled = canPrevious

    let nowPlayingInfoCenter = MPNowPlayingInfoCenter.default()
    if var nowPlayingInfo = nowPlayingInfoCenter.nowPlayingInfo {
      nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackQueueCount] = queueCount
      nowPlayingInfo[MPNowPlayingInfoPropertyPlaybackQueueIndex] = queueIndex
      nowPlayingInfoCenter.nowPlayingInfo = nowPlayingInfo
    }
  }

  private func removeRemoteCommands() {
    let commandCenter = MPRemoteCommandCenter.shared()
    if let nextTarget {
      commandCenter.nextTrackCommand.removeTarget(nextTarget)
      self.nextTarget = nil
    }
    if let previousTarget {
      commandCenter.previousTrackCommand.removeTarget(previousTarget)
      self.previousTarget = nil
    }
    commandCenter.nextTrackCommand.isEnabled = false
    commandCenter.previousTrackCommand.isEnabled = false

    let nowPlayingInfoCenter = MPNowPlayingInfoCenter.default()
    if var nowPlayingInfo = nowPlayingInfoCenter.nowPlayingInfo {
      nowPlayingInfo.removeValue(forKey: MPNowPlayingInfoPropertyPlaybackQueueCount)
      nowPlayingInfo.removeValue(forKey: MPNowPlayingInfoPropertyPlaybackQueueIndex)
      nowPlayingInfoCenter.nowPlayingInfo = nowPlayingInfo.isEmpty ? nil : nowPlayingInfo
    }
  }
}
