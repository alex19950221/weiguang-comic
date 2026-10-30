import Capacitor
import Foundation

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
        CAPPluginMethod(name: "setFullscreen", returnType: CAPPluginReturnPromise)
    ]

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
