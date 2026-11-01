import Capacitor
import Foundation
import UIKit
import UniformTypeIdentifiers

/// 正式 ZIP/CBZ/PDF/EPUB 导入。选择授权仅在本次进程保留，网页只拿到不透明标识。
@objc(ComicImportPlugin)
public class ComicImportPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "ComicImportPlugin"
    public let jsName = "ComicImport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "copyToLibrary", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeCopy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "releaseSources", returnType: CAPPluginReturnPromise)
    ]
    private var pickerCall: CAPPluginCall?
    // 以下状态只在主队列访问；Progress 的取消状态可跨线程读取。
    private var selected: [String: URL] = [:]
    private var jobs: [String: Progress] = [:]
    private let queue = DispatchQueue(label: "dev.weiguang.comic.library-import", qos: .userInitiated)

    @objc func pickFiles(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil else { call.reject("文件选择器已打开。"); return }
            guard let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                call.reject("文件选择器暂不可用。"); return
            }
            self.pickerCall = call
            let cbz = UTType(importedAs: "dev.weiguang.comic.cbz", conformingTo: .zip)
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.zip, cbz, .pdf, .epub], asCopy: false)
            picker.allowsMultipleSelection = true
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pickerCall?.resolve(["items": []])
        pickerCall = nil
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall else { return }
        pickerCall = nil
        // 不在主线程读取文件体，也不把外部 URL 传给 WebView。
        let items: [[String: Any]] = urls.map { url in
            let token = UUID().uuidString
            selected[token] = url
            return ["uri": token, "name": url.lastPathComponent, "size": 0, "isDirectory": false]
        }
        call.resolve(["items": items])
    }

    @objc func copyToLibrary(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let jobId = call.getString("jobId"), UUID(uuidString: jobId) != nil,
                  let bookId = call.getString("bookId"), UUID(uuidString: bookId) != nil,
                  let token = call.getObject("item")?["uri"] as? String,
                  let source = self.selected[token] else {
                call.reject("文件选择授权已失效，请重新选择文件。", "SOURCE_EXPIRED"); return
            }
            guard self.jobs[jobId] == nil else { call.reject("这个文件正在导入。"); return }
            guard ["zip", "cbz", "pdf", "epub"].contains(source.pathExtension.lowercased()) else {
                call.reject("目前支持导入 ZIP、CBZ、PDF 和 EPUB 文件。", "UNSUPPORTED_FORMAT"); return
            }
            let progress = Progress(totalUnitCount: 0)
            self.jobs[jobId] = progress
            self.queue.async {
                do {
                    let result = try self.copy(source, bookId: bookId, jobId: jobId, progress: progress)
                    DispatchQueue.main.async {
                        self.jobs.removeValue(forKey: jobId)
                        call.resolve(result)
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.jobs.removeValue(forKey: jobId)
                        call.reject(error.localizedDescription, progress.isCancelled ? "CANCELLED" : "IMPORT_ERROR")
                    }
                }
            }
        }
    }

    private func copy(_ source: URL, bookId: String, jobId: String, progress: Progress) throws -> [String: Any] {
        let access = source.startAccessingSecurityScopedResource()
        defer { if access { source.stopAccessingSecurityScopedResource() } }
        let root = try ComicStore.libraryRoot(prototype: false)
        // PDF/EPUB 副本保留扩展名，读取时据此选择 PDFKit 或 EPUB 目录；CBZ 与 ZIP 统一存为 .zip。
        let suffix = ["pdf", "epub"].first { $0 == source.pathExtension.lowercased() } ?? "zip"
        let destination = root.appendingPathComponent(bookId + "." + suffix)
        let temporary = root.appendingPathComponent(bookId + ".part")
        let fm = FileManager.default
        guard !fm.fileExists(atPath: destination.path) else { throw ComicError.invalid("漫画副本已经存在。") }
        // 同一 UUID 的上次未完成副本可清理，用户源文件永不写入。
        if fm.fileExists(atPath: temporary.path) { try fm.removeItem(at: temporary) }
        defer { if fm.fileExists(atPath: temporary.path) { try? fm.removeItem(at: temporary) } }
        var coordinationError: NSError?
        var copyError: Error?
        var size: UInt64 = 0
        NSFileCoordinator().coordinate(readingItemAt: source, options: .withoutChanges,
                                       error: &coordinationError) { coordinated in
            do {
                let values = try coordinated.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                guard values.isRegularFile == true, values.isSymbolicLink != true else {
                    throw ComicError.invalid("请选择 ZIP、CBZ、PDF 或 EPUB 文件。")
                }
                let input = try FileHandle(forReadingFrom: coordinated)
                defer { try? input.close() }
                size = try input.seekToEnd()
                // JS 元数据也必须精确表示大小；文件体始终不跨桥。
                guard size > 0, size <= 9_007_199_254_740_991 else { throw ComicError.invalid("文件大小无效。") }
                progress.totalUnitCount = Int64(size)
                try input.seek(toOffset: 0)
                guard fm.createFile(atPath: temporary.path, contents: nil) else { throw CocoaError(.fileWriteUnknown) }
                let output = try FileHandle(forWritingTo: temporary)
                defer { try? output.close() }
                var lastEvent: TimeInterval = 0
                while UInt64(progress.completedUnitCount) < size {
                    if progress.isCancelled { throw ComicError.invalid("已取消导入。") }
                    let remaining = size - UInt64(progress.completedUnitCount)
                    let count: Int = try autoreleasepool {
                        let chunk = try input.read(upToCount: Int(min(1_048_576, remaining))) ?? Data()
                        guard !chunk.isEmpty else { throw ComicError.invalid("文件在导入时发生变化，请重试。") }
                        try output.write(contentsOf: chunk)
                        return chunk.count
                    }
                    progress.completedUnitCount += Int64(count)
                    let now = ProcessInfo.processInfo.systemUptime
                    if now - lastEvent >= 0.1 {
                        self.notifyListeners("progress", data: ["jobId": jobId, "copied": progress.completedUnitCount, "total": size])
                        lastEvent = now
                    }
                }
                guard try input.seekToEnd() == size else { throw ComicError.invalid("文件在导入时发生变化，请重试。") }
                if progress.isCancelled { throw ComicError.invalid("已取消导入。") }
                try output.synchronize()
                try output.close()
            } catch { copyError = error }
        }
        if let error = coordinationError ?? (copyError as NSError?) { throw error }
        if progress.isCancelled { throw ComicError.invalid("已取消导入。") }
        var excluded = temporary
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
        // 复制完成后再改名；目录检查、指纹和入库由 TS 作业顺序调度。
        try fm.moveItem(at: temporary, to: destination)
        self.notifyListeners("progress", data: ["jobId": jobId, "copied": size, "total": size])
        return ["path": destination.path, "size": size]
    }

    @objc func cancel(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let id = call.getString("jobId") { self.jobs[id]?.cancel() }
            call.resolve()
        }
    }

    @objc func removeCopy(_ call: CAPPluginCall) {
        guard let id = call.getString("bookId"), UUID(uuidString: id) != nil else {
            call.reject("漫画标识无效。"); return
        }
        queue.async {
            do {
                let root = try ComicStore.libraryRoot(prototype: false)
                // 固定根目录 + 校验过的 UUID，无任意路径/递归删除入口。
                for suffix in ["zip", "pdf", "epub", "part"] {
                    let url = root.appendingPathComponent(id + "." + suffix)
                    if FileManager.default.fileExists(atPath: url.path) {
                        try FileManager.default.removeItem(at: url)
                    }
                }
                call.resolve()
            } catch { call.reject(error.localizedDescription, "CLEANUP_ERROR") }
        }
    }

    @objc func releaseSources(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            for token in call.getArray("uris", String.self) ?? [] {
                self.selected.removeValue(forKey: token)
            }
            call.resolve()
        }
    }
}
