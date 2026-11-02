import Capacitor
import Foundation
import LocalAuthentication

/// 承载 WebView 的控制器负责遮挡画面：切到后台或多任务界面时盖住内容。
public protocol ComicPrivacyHost: AnyObject {
    func setComicPrivacyCover(_ enabled: Bool)
    /// 网页已经显示锁屏，可以移开遮挡。
    func revealComicContent()
}

/// 应用锁（Pro）：面容 ID / 触控 ID，失败或不可用时回落到设备密码。只返回是否通过，不接触任何生物信息。
@objc(ComicLockPlugin)
public class ComicLockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ComicLockPlugin"
    public let jsName = "ComicLock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "availability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setPrivacyCover", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reveal", returnType: CAPPluginReturnPromise)
    ]
    private var authenticating = false

    static func biometry(_ context: LAContext) -> String {
        switch context.biometryType {
        case .faceID: return "faceID"
        case .touchID: return "touchID"
        default: return "none"
        }
    }

    @objc func availability(_ call: CAPPluginCall) {
        let context = LAContext()
        var error: NSError?
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        // biometryType 只有在 canEvaluatePolicy 之后才有值。
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        call.resolve(["available": available, "biometry": Self.biometry(context)])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let reason = call.getString("reason") ?? "解锁微光漫画"
        DispatchQueue.main.async {
            guard !self.authenticating else { call.resolve(["ok": false, "reason": "busy"]); return }
            self.authenticating = true
            let context = LAContext()
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, error in
                DispatchQueue.main.async {
                    self.authenticating = false
                    if success { call.resolve(["ok": true]); return }
                    let code = (error as? LAError)?.code
                    let result: String
                    switch code {
                    case .userCancel?, .appCancel?, .systemCancel?, .userFallback?:
                        result = "cancelled"
                    case .passcodeNotSet?:
                        // 设备已关闭密码：无法再验证，网页据此放行，避免把用户锁在外面。
                        result = "unavailable"
                    default:
                        result = "failed"
                    }
                    call.resolve(["ok": false, "reason": result])
                }
            }
        }
    }

    @objc func setPrivacyCover(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        DispatchQueue.main.async {
            (self.bridge?.viewController as? ComicPrivacyHost)?.setComicPrivacyCover(enabled)
            call.resolve()
        }
    }

    @objc func reveal(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? ComicPrivacyHost)?.revealComicContent()
            call.resolve()
        }
    }
}
