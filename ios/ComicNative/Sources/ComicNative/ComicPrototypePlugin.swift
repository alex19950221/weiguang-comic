import Capacitor
import Foundation
import UIKit
import UniformTypeIdentifiers

/// M0 专用入口，不替代 M1 的 ImportPlugin 作业与持久化模型。
@objc(ComicPrototypePlugin)
public class ComicPrototypePlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "ComicPrototypePlugin"
    public let jsName = "ComicPrototype"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickZip", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reset", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?
    private var copying: Progress?
    private let queue = DispatchQueue(label: "dev.weiguang.comic.import", qos: .userInitiated)

    @objc func pickZip(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("请等待当前导入完成。"); return }
            guard let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                call.reject("文件选择器暂不可用。"); return
            }
            self.pending = call
            let cbz = UTType(importedAs: "dev.weiguang.comic.cbz", conformingTo: .zip)
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.zip, cbz], asCopy: false)
            picker.allowsMultipleSelection = false
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pending?.resolve(["cancelled": true])
        pending = nil
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pending, let url = urls.first else {
            pending?.resolve(["cancelled": true]); pending = nil; return
        }
        let progress = Progress(totalUnitCount: 0)
        copying = progress
        queue.async {
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            do {
                let root = try ComicStore.libraryRoot()
                let bookId = UUID().uuidString
                let destination = root.appendingPathComponent(bookId + ".zip")
                let started = ProcessInfo.processInfo.systemUptime
                var coordinationError: NSError?
                var copyError: Error?
                var size: UInt64 = 0
                NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges,
                                                error: &coordinationError) { source in
                    do {
                        let input = try FileHandle(forReadingFrom: source)
                        defer { try? input.close() }
                        size = try input.seekToEnd()
                        guard size <= UInt64(Int64.max) else { throw ComicError.invalid("文件大小无效。") }
                        progress.totalUnitCount = Int64(size)
                        try input.seek(toOffset: 0)
                        guard FileManager.default.createFile(atPath: destination.path, contents: nil) else {
                            throw CocoaError(.fileWriteUnknown)
                        }
                        let output = try FileHandle(forWritingTo: destination)
                        defer { try? output.close() }
                        var lastEvent: TimeInterval = 0
                        while true {
                            if progress.isCancelled { throw ComicError.invalid("已取消导入。") }
                            let count: Int = try autoreleasepool {
                                let data = try input.read(upToCount: 1_048_576) ?? Data()
                                if !data.isEmpty { try output.write(contentsOf: data) }
                                return data.count
                            }
                            if count == 0 { break }
                            progress.completedUnitCount += Int64(count)
                            let now = ProcessInfo.processInfo.systemUptime
                            if now - lastEvent >= 0.1 {
                                self.notifyListeners("progress", data: ["copied": progress.completedUnitCount, "total": size])
                                lastEvent = now
                            }
                        }
                        guard UInt64(progress.completedUnitCount) == size else {
                            throw ComicError.invalid("文件在导入时发生变化，请重试。")
                        }
                        var excluded = destination
                        var values = URLResourceValues()
                        values.isExcludedFromBackup = true
                        try excluded.setResourceValues(values)
                        _ = try ZipDirectory.read(destination)
                    } catch { copyError = error }
                }
                if let error = coordinationError ?? (copyError as NSError?) {
                    try? FileManager.default.removeItem(at: destination)
                    throw error
                }
                if progress.isCancelled {
                    try? FileManager.default.removeItem(at: destination)
                    throw ComicError.invalid("已取消导入。")
                }
                let elapsed = (ProcessInfo.processInfo.systemUptime - started) * 1000
                DispatchQueue.main.async {
                    self.pending = nil; self.copying = nil
                    call.resolve(["cancelled": false, "bookId": bookId, "path": destination.path,
                                  "name": url.lastPathComponent, "size": size, "copyMs": elapsed])
                }
            } catch {
                DispatchQueue.main.async {
                    self.pending = nil; self.copying = nil
                    call.reject(error.localizedDescription, progress.isCancelled ? "CANCELLED" : "IMPORT_ERROR")
                }
            }
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async { self.copying?.cancel(); call.resolve() }
    }

    @objc func reset(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("导入过程中不能清理。"); return }
            self.queue.async {
                do {
                    let root = try ComicStore.libraryRoot()
                    for url in try FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
                        guard url.pathExtension == "zip",
                              UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil else { continue }
                        try FileManager.default.removeItem(at: url)
                    }
                    call.resolve()
                } catch { call.reject(error.localizedDescription) }
            }
        }
    }
}
