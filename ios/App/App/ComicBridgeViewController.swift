import Capacitor
import ComicNative
import UIKit

final class ComicBridgeViewController: CAPBridgeViewController, ComicReaderDisplayHost, ComicPrivacyHost {
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

    // 应用锁开启时，切到后台或多任务界面先盖住画面；从后台回来要等网页显示锁屏后才移开。
    private var privacyCoverEnabled = false
    private var waitingForWeb = false
    private var privacyCover: UIView?

    func setComicPrivacyCover(_ enabled: Bool) {
        privacyCoverEnabled = enabled
        if !enabled {
            waitingForWeb = false
            hidePrivacyCover()
        }
    }

    func revealComicContent() {
        waitingForWeb = false
        hidePrivacyCover()
    }

    private func showPrivacyCover() {
        guard privacyCoverEnabled, privacyCover == nil else { return }
        let cover = UIView(frame: view.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = UIColor(red: 254 / 255, green: 251 / 255, blue: 240 / 255, alpha: 1)
        let lock = UIImageView(image: UIImage(systemName: "lock.fill"))
        lock.tintColor = UIColor(red: 0.30, green: 0.37, blue: 0.27, alpha: 1)
        lock.translatesAutoresizingMaskIntoConstraints = false
        cover.addSubview(lock)
        NSLayoutConstraint.activate([
            lock.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
            lock.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
            lock.widthAnchor.constraint(equalToConstant: 44),
            lock.heightAnchor.constraint(equalToConstant: 52)
        ])
        view.addSubview(cover)
        privacyCover = cover
    }

    private func hidePrivacyCover() {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
    }

    @objc private func appWillResignActive() { showPrivacyCover() }

    @objc private func appDidEnterBackground() {
        guard privacyCoverEnabled else { return }
        waitingForWeb = true
        showPrivacyCover()
    }

    @objc private func appDidBecomeActive() {
        guard waitingForWeb else { hidePrivacyCover(); return }
        // 网页正常会很快调用 reveal；万一没有回应，1.5 秒后移开，避免一直盖住锁屏按钮。
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            guard let self, self.waitingForWeb else { return }
            self.revealComicContent()
        }
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
        bridge?.registerPluginInstance(ProStorePlugin())
        bridge?.registerPluginInstance(ComicLockPlugin())
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(appWillResignActive),
                           name: UIApplication.willResignActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(appDidEnterBackground),
                           name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(appDidBecomeActive),
                           name: UIApplication.didBecomeActiveNotification, object: nil)
        #if DEBUG
        bridge?.registerPluginInstance(ComicPrototypePlugin())
        #endif
    }
}

/// 只提供 Home 指示条偏好，不加载视图。
private final class HiddenHomeIndicatorController: UIViewController {
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
