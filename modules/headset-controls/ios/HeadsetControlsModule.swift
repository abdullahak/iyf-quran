import ExpoModulesCore
import MediaPlayer

public final class HeadsetControlsModule: Module {
  private var nextTarget: Any?
  private var previousTarget: Any?

  public func definition() -> ModuleDefinition {
    Name("HeadsetControls")
    Events("onCommand")

    Function("configure") { (active: Bool, canPrevious: Bool, canNext: Bool) in
      DispatchQueue.main.async {
        self.configureRemoteCommands(
          active: active,
          canPrevious: canPrevious,
          canNext: canNext
        )
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.removeRemoteCommands()
      }
    }
  }

  private func configureRemoteCommands(active: Bool, canPrevious: Bool, canNext: Bool) {
    guard active else {
      removeRemoteCommands()
      return
    }

    let commandCenter = MPRemoteCommandCenter.shared()
    commandCenter.nextTrackCommand.isEnabled = canNext
    commandCenter.previousTrackCommand.isEnabled = canPrevious

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
  }
}
