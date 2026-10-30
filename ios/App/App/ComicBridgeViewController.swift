import Capacitor
import ComicNative
import UIKit

final class ComicBridgeViewController: CAPBridgeViewController, ComicReaderDisplayHost {
    private(set) var comicReaderFullscreen = false
    // Capacitor 8 的 SystemBars 扩展以 public（非 open）重写了 prefersHomeIndicatorAutoHidden，
    // 子类跨模块不能再重写；全屏时改由子控制器提供自动隐藏偏好，平时仍走 Capacitor 默认逻辑。
    private let fullscreenIndicator = HiddenHomeIndicatorController()

    override var prefersStatusBarHidden: Bool {
        comicReaderFullscreen || super.prefersStatusBarHidden
    }

    override var childForHomeIndicatorAutoHidden: UIViewController? {
        comicReaderFullscreen ? fullscreenIndicator : super.childForHomeIndicatorAutoHidden
    }

    func setComicReaderFullscreen(_ enabled: Bool) {
        comicReaderFullscreen = enabled
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        addChild(fullscreenIndicator)
        fullscreenIndicator.didMove(toParent: self)
        bridge?.registerPluginInstance(ComicArchivePlugin())
        bridge?.registerPluginInstance(ComicImportPlugin())
        bridge?.registerPluginInstance(ComicReaderPlugin())
        #if DEBUG
        bridge?.registerPluginInstance(ComicPrototypePlugin())
        #endif
    }
}

/// 只提供 Home 指示条偏好，不加载视图。
private final class HiddenHomeIndicatorController: UIViewController {
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
