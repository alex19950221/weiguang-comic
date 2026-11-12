import UIKit
import Capacitor
import ComicNative

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        // 冷启动时先登记「用…打开」的文件，桥接加载时的 Inbox 清理才不会删掉它们。
        ComicOpenedFiles.shared.receive(connectionOptions.urlContexts.map(\.url))

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = ComicBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        ComicOpenedFiles.shared.receive(URLContexts.map(\.url))
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
