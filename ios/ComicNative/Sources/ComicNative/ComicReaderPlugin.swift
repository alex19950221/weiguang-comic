import Capacitor
import Foundation
import UIKit

/// 系统栏显示交给承载 WebView 的控制器，避免操作其他窗口。
public protocol ComicReaderDisplayHost: AnyObject {
    var comicReaderFullscreen: Bool { get }
    func setComicReaderFullscreen(_ enabled: Bool)
}

@objc(ComicReaderPlugin)
public class ComicReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ComicReaderPlugin"
    public let jsName = "ComicReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getDisplayState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setFullscreen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setKeepAwake", returnType: CAPPluginReturnPromise)
    ]
    private var inactiveObserver: NSObjectProtocol?

    override public func load() {
        inactiveObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
        ) { _ in UIApplication.shared.isIdleTimerDisabled = false }
    }

    deinit {
        if let observer = inactiveObserver { NotificationCenter.default.removeObserver(observer) }
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = false }
    }

    @objc func setKeepAwake(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing display state.", "INVALID_ARGUMENT"); return
        }
        DispatchQueue.main.async {
            // 只在前台用户主动播放时保持常亮；失活的原生兜底不依赖网页定时器。
            guard !enabled || UIApplication.shared.applicationState == .active else {
                call.reject("Reading display is inactive.", "DISPLAY_INACTIVE"); return
            }
            UIApplication.shared.isIdleTimerDisabled = enabled
            call.resolve(["enabled": UIApplication.shared.isIdleTimerDisabled])
        }
    }

    @objc func getDisplayState(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController as? ComicReaderDisplayHost else {
                call.reject("Fullscreen display is unavailable.", "DISPLAY_UNAVAILABLE"); return
            }
            call.resolve(["fullscreen": host.comicReaderFullscreen])
        }
    }

    @objc func setFullscreen(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else {
            call.reject("Missing fullscreen state.", "INVALID_ARGUMENT"); return
        }
        DispatchQueue.main.async {
            guard let host = self.bridge?.viewController as? ComicReaderDisplayHost else {
                call.reject("Fullscreen display is unavailable.", "DISPLAY_UNAVAILABLE"); return
            }
            host.setComicReaderFullscreen(enabled)
            call.resolve(["fullscreen": host.comicReaderFullscreen])
        }
    }
}
