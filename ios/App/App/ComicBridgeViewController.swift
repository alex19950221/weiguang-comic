import Capacitor
import ComicNative

final class ComicBridgeViewController: CAPBridgeViewController, ComicReaderDisplayHost {
    private(set) var comicReaderFullscreen = false

    override var prefersStatusBarHidden: Bool {
        comicReaderFullscreen || super.prefersStatusBarHidden
    }

    override var prefersHomeIndicatorAutoHidden: Bool {
        comicReaderFullscreen || super.prefersHomeIndicatorAutoHidden
    }

    func setComicReaderFullscreen(_ enabled: Bool) {
        comicReaderFullscreen = enabled
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ComicArchivePlugin())
        bridge?.registerPluginInstance(ComicImportPlugin())
        bridge?.registerPluginInstance(ComicReaderPlugin())
        #if DEBUG
        bridge?.registerPluginInstance(ComicPrototypePlugin())
        #endif
    }
}
