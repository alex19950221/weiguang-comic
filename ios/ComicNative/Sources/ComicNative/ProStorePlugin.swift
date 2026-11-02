import Capacitor
import Foundation
import StoreKit

/// 微光 Pro 一次买断（StoreKit 2 非消耗型）。只向网页暴露是否已解锁、价格和购买/恢复；
/// 不保存任何账号或凭证。权益来自系统缓存的交易记录，离线时仍能判断。
@objc(ProStorePlugin)
public class ProStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProStorePlugin"
    public let jsName = "ProStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]
    static let productID = "dev.weiguang.comic.pro"
    private var updates: Task<Void, Never>?

    override public func load() {
        // 家人共享、退款、其他设备购买、“询问购买”批准都经此到达；处理完通知网页重新读取状态。
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                guard let self else { return }
                self.notifyListeners("change", data: await ProStorePlugin.snapshot(product: false))
            }
        }
    }

    deinit { updates?.cancel() }

    static func environment() -> String {
        #if DEBUG
        return "development"
        #else
        // TestFlight 与开发签名使用沙盒收据；正式商店为 receipt。
        return Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt" ? "sandbox" : "production"
        #endif
    }

    static func entitled() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == productID,
               transaction.revocationDate == nil {
                return true
            }
        }
        return false
    }

    static func snapshot(product: Bool) async -> [String: Any] {
        var result: [String: Any] = ["active": await entitled(), "environment": environment()]
        if product, let item = try? await Product.products(for: [productID]).first {
            result["price"] = item.displayPrice
        }
        return result
    }

    @objc func status(_ call: CAPPluginCall) {
        let product = call.getBool("product") ?? false
        Task { call.resolve(await ProStorePlugin.snapshot(product: product)) }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [ProStorePlugin.productID]).first else {
                    call.reject("暂时无法获取 Pro 商品信息，请稍后重试。", "PRODUCT_UNAVAILABLE"); return
                }
                let state: String
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification else {
                        call.reject("购买凭证校验失败，请稍后在设置中恢复购买。", "UNVERIFIED"); return
                    }
                    await transaction.finish()
                    state = "purchased"
                case .pending:
                    state = "pending"
                case .userCancelled:
                    state = "cancelled"
                @unknown default:
                    state = "cancelled"
                }
                var result = await ProStorePlugin.snapshot(product: false)
                result["state"] = state
                call.resolve(result)
            } catch {
                call.reject(error.localizedDescription, "PURCHASE_ERROR")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            var state = "restored"
            do {
                try await AppStore.sync()
            } catch StoreKitError.userCancelled {
                state = "cancelled"
            } catch {
                call.reject(error.localizedDescription, "RESTORE_ERROR"); return
            }
            var result = await ProStorePlugin.snapshot(product: false)
            result["state"] = state
            call.resolve(result)
        }
    }
}
