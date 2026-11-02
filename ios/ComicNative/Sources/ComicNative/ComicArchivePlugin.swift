import Capacitor
import Foundation

@objc(ComicArchivePlugin)
public class ComicArchivePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ComicArchivePlugin"
    public let jsName = "ComicArchive"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "inspect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renderPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "thumbnail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "fingerprint", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disposeBook", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCache", returnType: CAPPluginReturnPromise)
    ]
    private let queue = DispatchQueue(label: "dev.weiguang.comic.archive", qos: .userInitiated)
    private let store = ComicStore()

    private func run(_ call: CAPPluginCall, work: @escaping () throws -> [String: Any]) {
        queue.async {
            autoreleasepool {
                do { call.resolve(try work()) }
                catch { call.reject(error.localizedDescription, "ARCHIVE_ERROR") }
            }
        }
    }

    @objc func inspect(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else { call.reject("缺少文件路径。"); return }
        run(call) { try self.store.inspect(path) }
    }

    @objc func renderPage(_ call: CAPPluginCall) {
        render(call, maxPixel: call.getInt("maxPixel") ?? 2048)
    }

    @objc func thumbnail(_ call: CAPPluginCall) { render(call, maxPixel: 400) }

    private func render(_ call: CAPPluginCall, maxPixel: Int) {
        guard let path = call.getString("path"), let bookId = call.getString("bookId"),
              let index = call.getInt("entry"), index >= 0 else { call.reject("页面参数无效。"); return }
        let crop = call.getBool("crop") == true
        run(call) {
            try self.store.render(path: path, bookId: bookId, index: index, maxPixel: maxPixel, crop: crop)
        }
    }

    @objc func fingerprint(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else { call.reject("缺少文件路径。"); return }
        run(call) { try self.store.fingerprint(path) }
    }

    @objc func clearCache(_ call: CAPPluginCall) {
        run(call) {
            try self.store.clearCache(bookId: call.getString("bookId"))
            return [:]
        }
    }

    @objc func disposeBook(_ call: CAPPluginCall) {
        guard let id = call.getString("bookId"), let deleteCopy = call.getBool("deleteCopy") else {
            call.reject("清理参数无效。"); return
        }
        run(call) {
            try self.store.disposeBook(bookId: id, deleteCopy: deleteCopy)
            return [:]
        }
    }
}
