import CryptoKit
import Foundation
import ImageIO
import PDFKit
import UIKit
import UniformTypeIdentifiers
import ZIPFoundation

/// 仅由 ComicArchivePlugin 的串行工作队列调用，Archive 的文件指针不跨线程共享。
final class ComicStore {
    private let fm = FileManager.default
    private let cacheLimit = 500 * 1024 * 1024
    private var opened: (path: String, archive: Archive, entries: [Entry], directory: [ZipItem])?
    private var openedPDF: (path: String, document: PDFDocument)?

    static func libraryRoot(prototype: Bool = true) throws -> URL {
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        var root = base.appendingPathComponent(prototype ? "ComicPrototype" : "ComicLibrary", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try root.setResourceValues(values)
        return root
    }

    /// 应用更新或从备份恢复后沙盒容器路径会变化；网页保存的旧绝对路径只取库目录名和 UUID 文件名，
    /// 在当前容器的固定根目录中重新定位副本，不接受其他路径。
    func source(_ path: String) throws -> URL {
        let stored = URL(fileURLWithPath: path)
        let folder = stored.deletingLastPathComponent().lastPathComponent
        guard folder == "ComicLibrary" || folder == "ComicPrototype", ["zip", "pdf", "epub"].contains(stored.pathExtension),
              UUID(uuidString: stored.deletingPathExtension().lastPathComponent) != nil else {
            throw ComicError.invalid("只能读取应用导入的漫画副本。")
        }
        let url = try Self.libraryRoot(prototype: folder == "ComicPrototype")
            .appendingPathComponent(stored.lastPathComponent)
        // 副本只由应用写入；仍拒绝符号链接，避免读到容器外的文件。
        guard (try? url.resourceValues(forKeys: [.isSymbolicLinkKey]))?.isSymbolicLink != true else {
            throw ComicError.invalid("只能读取应用导入的漫画副本。")
        }
        return url
    }

    private func open(_ path: String) throws -> (archive: Archive, entries: [Entry], directory: [ZipItem]) {
        let url = try source(path)
        if let existing = opened, existing.path == url.path {
            return (existing.archive, existing.entries, existing.directory)
        }
        let directory = try ZipDirectory.read(url)
        guard !directory.contains(where: { $0.encrypted }) else {
            throw ComicError.invalid("暂不支持加密压缩包，请选择未加密的自有文件。")
        }
        let archive = try Archive(url: url, accessMode: .read)
        let entries = Array(archive)
        guard entries.count == directory.count else { throw ComicError.invalid("压缩包目录不完整。") }
        opened = (url.path, archive, entries, directory)
        return (archive, entries, directory)
    }

    /// PDF 用系统 PDFKit 读取；需要密码才能打开的文件不尝试解锁（不处理 DRM）。
    private func openPDF(_ url: URL) throws -> PDFDocument {
        if let existing = openedPDF, existing.path == url.path { return existing.document }
        guard let document = PDFDocument(url: url) else {
            throw ComicError.invalid("PDF 已损坏或格式不受支持。")
        }
        guard !document.isLocked else {
            throw ComicError.invalid("暂不支持需要密码的 PDF，请选择未加密的自有文件。")
        }
        openedPDF = (url.path, document)
        return document
    }

    func inspect(_ path: String) throws -> [String: Any] {
        let url = try source(path)
        if url.pathExtension == "pdf" {
            guard let document = PDFDocument(url: url) else {
                throw ComicError.invalid("PDF 已损坏或格式不受支持。")
            }
            let count = document.isLocked ? 0 : document.pageCount
            let entries: [[String: Any]] = (0..<count).map { index in
                ["index": index, "name": String(format: "%04d", index + 1), "size": 1,
                 "isDirectory": false, "isSymlink": false]
            }
            return ["format": "pdf", "encrypted": document.isLocked, "entries": entries]
        }
        let directory = try ZipDirectory.read(url)
        let encrypted = directory.contains(where: { $0.encrypted })
        if url.pathExtension == "epub" {
            var result: [String: Any] = ["format": "epub", "encrypted": encrypted,
                                         "entries": directory.map(\.json)]
            if !encrypted { result["texts"] = try epubTexts(url.path, directory: directory) }
            return result
        }
        var result: [String: Any] = ["format": "zip", "encrypted": encrypted,
                                     "entries": directory.map(\.json)]
        if !encrypted, let manga = mangaDirection(url) { result["manga"] = manga }
        return result
    }

    /// EPUB 的阅读顺序在网页层纯逻辑中解析：这里只交出容器、OPF 与页面文档等小文本，
    /// 单个不超过 1 MiB、合计不超过 16 MiB；图片等文件体始终不跨桥。
    private func epubTexts(_ path: String, directory: [ZipItem]) throws -> [[String: Any]] {
        let book = try open(path)
        let textTypes: Set<String> = ["xml", "opf", "xhtml", "html", "htm", "svg"]
        var total: UInt64 = 0
        var texts: [[String: Any]] = []
        for item in directory where !item.directory && !item.symlink && item.size > 0 && item.size <= 1_048_576 {
            let name = String(decoding: item.rawName, as: UTF8.self)
            guard textTypes.contains(URL(fileURLWithPath: name).pathExtension.lowercased()),
                  total + item.size <= 16 * 1_048_576, book.entries.indices.contains(item.index),
                  book.entries[item.index].type == .file else { continue }
            let entry = book.entries[item.index]
            var data = Data()
            let crc = try book.archive.extract(entry, bufferSize: 64 * 1024) { chunk in
                guard data.count + chunk.count <= 1_048_576 else { throw ComicError.invalid("EPUB 文档大小异常。") }
                data.append(chunk)
            }
            guard crc == entry.checksum else { throw ComicError.invalid("EPUB 文档校验失败，文件可能已损坏。") }
            total += UInt64(data.count)
            texts.append(["index": item.index, "text": String(decoding: data, as: UTF8.self)])
        }
        return texts
    }

    /// 根目录 ComicInfo.xml 的 <Manga> 标记（ComicInfo 规范）：YesAndRightToLeft/Yes 视为右翻书。
    /// 文件缺失或无法解析时返回 nil，不阻断导入。
    private func mangaDirection(_ url: URL) -> String? {
        guard let archive = try? Archive(url: url, accessMode: .read),
              let entry = archive.first(where: {
                  $0.path.replacingOccurrences(of: "\\", with: "/")
                      .caseInsensitiveCompare("ComicInfo.xml") == .orderedSame
              }) else { return nil }
        var data = Data()
        _ = try? archive.extract(entry, bufferSize: 64 * 1024) { chunk in
            if data.count + chunk.count <= 1_048_576 { data.append(chunk) }
        }
        guard data.count <= 1_048_576, let text = String(data: data, encoding: .utf8),
              let match = text.range(of: #"(?i)<manga>\s*([^<]+?)\s*</manga>"#,
                                     options: .regularExpression) else { return nil }
        let value = text[match]
            .replacingOccurrences(of: #"(?i)</?manga>"#, with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        return ["yesandrighttoleft", "yes"].contains(value.lowercased()) ? "rtl" : nil
    }

    func fingerprint(_ path: String) throws -> [String: Any] {
        let file = try FileHandle(forReadingFrom: source(path))
        defer { try? file.close() }
        let size = try file.seekToEnd()
        var hash = SHA256()
        // 跨端固定协议：十进制 UTF-8 大小 + LF + 前 1 MiB + 后 1 MiB。
        hash.update(data: Data("\(size)\n".utf8))
        try file.seek(toOffset: 0)
        hash.update(data: try file.read(upToCount: Int(min(size, 1_048_576))) ?? Data())
        try file.seek(toOffset: size - min(size, 1_048_576))
        hash.update(data: try file.read(upToCount: Int(min(size, 1_048_576))) ?? Data())
        return ["sha256": hash.finalize().map { String(format: "%02x", $0) }.joined(), "size": size]
    }

    private func cacheRoot() throws -> URL {
        let base = try fm.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        let root = base.appendingPathComponent("ComicPages-v1", isDirectory: true)
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    func render(path: String, bookId: String, index: Int, maxPixel: Int, crop: Bool = false) throws -> [String: Any] {
        guard UUID(uuidString: bookId) != nil,
              URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent == bookId else {
            throw ComicError.invalid("漫画标识无效。")
        }
        let sourceURL = try source(path)
        let root = try cacheRoot()
        let requested = min(8192, max(256, maxPixel))
        // 裁白边的结果单独缓存，开关切换时不互相覆盖。
        let cache = root.appendingPathComponent("\(bookId)-\(index)-\(requested)\(crop ? "-crop" : "").png")
        let metadata = cache.appendingPathExtension("json")
        if fm.fileExists(atPath: cache.path),
           let data = try? Data(contentsOf: metadata),
           var result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            try? fm.setAttributes([.modificationDate: Date()], ofItemAtPath: cache.path)
            result["url"] = cache.absoluteString
            result["cached"] = true
            return result
        }
        if sourceURL.pathExtension == "pdf" {
            return try renderPDF(sourceURL, index: index, requested: requested, cache: cache,
                                 metadata: metadata, root: root, crop: crop)
        }
        let book = try open(sourceURL.path)
        guard book.entries.indices.contains(index), book.directory.indices.contains(index),
              book.entries[index].type == .file, !book.directory[index].symlink,
              !book.directory[index].directory else { throw ComicError.invalid("漫画页不存在。") }
        let item = book.entries[index]
        guard item.uncompressedSize <= 256 * 1024 * 1024 else {
            throw ComicError.invalid("单张图片超过 256 MB，暂不支持。")
        }
        // 随机临时路径，绝不使用压缩包内的路径写文件。
        let temporary = root.appendingPathComponent(UUID().uuidString + ".entry")
        guard fm.createFile(atPath: temporary.path, contents: nil) else { throw CocoaError(.fileWriteUnknown) }
        defer { try? fm.removeItem(at: temporary) }
        let output = try FileHandle(forWritingTo: temporary)
        defer { try? output.close() }
        var written: UInt64 = 0
        let crc = try book.archive.extract(item, bufferSize: 64 * 1024) { chunk in
            written += UInt64(chunk.count)
            guard written <= item.uncompressedSize, written <= 256 * 1024 * 1024 else {
                throw ComicError.invalid("图片解压大小异常。")
            }
            try output.write(contentsOf: chunk)
        }
        guard crc == item.checksum, written == item.uncompressedSize else {
            throw ComicError.invalid("图片校验失败，文件可能已损坏。")
        }
        try output.close()
        guard let imageSource = CGImageSourceCreateWithURL(temporary as CFURL,
                                                         [kCGImageSourceShouldCache: false] as CFDictionary),
              let properties = CGImageSourceCopyPropertiesAtIndex(imageSource, 0, nil) as? [CFString: Any],
              let width = properties[kCGImagePropertyPixelWidth] as? Int,
              let height = properties[kCGImagePropertyPixelHeight] as? Int,
              width > 0, height > 0 else { throw ComicError.invalid("图片已损坏或格式不受支持。") }
        let orientation = properties[kCGImagePropertyOrientation] as? Int ?? 1
        let rotated = (5...8).contains(orientation)
        let sourceWidth = rotated ? height : width
        let sourceHeight = rotated ? width : height
        // 限制单页解码为四百万像素，同时限制长边；长条漫仍保持原始比例。
        let longSide = Double(max(width, height))
        let budget = sqrt(4_000_000 / (Double(width) * Double(height)))
        let target = max(1, Int(min(Double(requested), longSide, longSide * budget)))
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceThumbnailMaxPixelSize: target
        ]
        guard let decoded = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, options as CFDictionary),
              let destination = CGImageDestinationCreateWithURL(cache as CFURL, UTType.png.identifier as CFString, 1, nil)
        else { throw ComicError.invalid("无法生成漫画预览。") }
        let trimmed = crop ? ContentBounds.crop(decoded) : (image: decoded, widthRatio: 1.0, heightRatio: 1.0)
        let image = trimmed.image
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            try? fm.removeItem(at: cache)
            throw ComicError.invalid("页面缓存写入失败，请检查可用空间。")
        }
        // 原图尺寸按保留比例换算，阅读器用它计算版面比例。
        let result: [String: Any] = ["width": image.width, "height": image.height,
                                    "sourceWidth": max(1, Int((Double(sourceWidth) * trimmed.widthRatio).rounded())),
                                    "sourceHeight": max(1, Int((Double(sourceHeight) * trimmed.heightRatio).rounded()))]
        try JSONSerialization.data(withJSONObject: result).write(to: metadata, options: .atomic)
        try trimCache(root, keeping: cache)
        return result.merging(["url": cache.absoluteString, "cached": false]) { _, new in new }
    }

    private func renderPDF(_ url: URL, index: Int, requested: Int, cache: URL, metadata: URL,
                           root: URL, crop: Bool) throws -> [String: Any] {
        let document = try openPDF(url)
        guard index < document.pageCount, let page = document.page(at: index) else {
            throw ComicError.invalid("漫画页不存在。")
        }
        let box = page.bounds(for: .cropBox)
        let rotated = abs(page.rotation) % 180 == 90
        let width = Double(rotated ? box.height : box.width)
        let height = Double(rotated ? box.width : box.height)
        guard width >= 1, height >= 1, width.isFinite, height.isFinite else {
            throw ComicError.invalid("PDF 页面尺寸无效。")
        }
        // 与图片页同一预算：长边不超过请求尺寸，总像素不超过四百万；矢量页允许放大到请求尺寸。
        let scale = min(Double(requested) / max(width, height), sqrt(4_000_000 / (width * height)))
        let size = CGSize(width: max(1, (width * scale).rounded()), height: max(1, (height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let image = UIGraphicsImageRenderer(size: size, format: format).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            let cg = context.cgContext
            // PDF 坐标原点在左下角；先翻转，再按页面旋转后的尺寸缩放绘制。
            cg.translateBy(x: 0, y: size.height)
            cg.scaleBy(x: size.width / CGFloat(width), y: -size.height / CGFloat(height))
            page.draw(with: .cropBox, to: cg)
        }
        guard let rendered = image.cgImage,
              let destination = CGImageDestinationCreateWithURL(cache as CFURL, UTType.png.identifier as CFString, 1, nil)
        else { throw ComicError.invalid("无法生成漫画预览。") }
        let trimmed = crop ? ContentBounds.crop(rendered) : (image: rendered, widthRatio: 1.0, heightRatio: 1.0)
        let cgImage = trimmed.image
        CGImageDestinationAddImage(destination, cgImage, nil)
        guard CGImageDestinationFinalize(destination) else {
            try? fm.removeItem(at: cache)
            throw ComicError.invalid("页面缓存写入失败，请检查可用空间。")
        }
        let result: [String: Any] = ["width": cgImage.width, "height": cgImage.height,
                                    "sourceWidth": max(1, Int((width * trimmed.widthRatio).rounded())),
                                    "sourceHeight": max(1, Int((height * trimmed.heightRatio).rounded()))]
        try JSONSerialization.data(withJSONObject: result).write(to: metadata, options: .atomic)
        try trimCache(root, keeping: cache)
        return result.merging(["url": cache.absoluteString, "cached": false]) { _, new in new }
    }

    private func trimCache(_ root: URL, keeping: URL) throws {
        let urls = try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey])
        let files = try urls.filter { $0.pathExtension == "png" }.map { url -> (URL, Int, Date) in
            let info = try url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
            let sidecarSize = (try? url.appendingPathExtension("json").resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return (url, (info.fileSize ?? 0) + sidecarSize, info.contentModificationDate ?? .distantPast)
        }.sorted { $0.2 < $1.2 }
        var bytes = files.reduce(0) { $0 + $1.1 }
        for (url, size, _) in files where bytes > cacheLimit && url != keeping {
            try fm.removeItem(at: url)
            try? fm.removeItem(at: url.appendingPathExtension("json"))
            bytes -= size
        }
    }

    func clearCache(bookId: String?) throws {
        if let id = bookId, UUID(uuidString: id) == nil { throw ComicError.invalid("漫画标识无效。") }
        let root = try cacheRoot()
        for file in try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil) {
            if bookId == nil || file.lastPathComponent.hasPrefix(bookId! + "-") { try fm.removeItem(at: file) }
        }
        opened = nil
        openedPDF = nil
    }

    /// 与渲染同一串行队列，先释放归档句柄；固定目录和 UUID，不接受任意路径。
    func disposeBook(bookId: String, deleteCopy: Bool) throws {
        guard UUID(uuidString: bookId) != nil else { throw ComicError.invalid("漫画标识无效。") }
        opened = nil
        openedPDF = nil
        try clearCache(bookId: bookId)
        guard deleteCopy else { return }
        let root = try Self.libraryRoot(prototype: false).resolvingSymlinksInPath().standardizedFileURL
        for suffix in ["zip", "pdf", "epub", "part"] {
            let file = root.appendingPathComponent(bookId + "." + suffix)
            // 不跟随外部符号链接；不存在的副本视为已经完成，允许断电后重试。
            if fm.fileExists(atPath: file.path) {
                let values = try file.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey])
                guard values.isSymbolicLink != true, values.isRegularFile == true,
                      file.resolvingSymlinksInPath().deletingLastPathComponent() == root else {
                    throw ComicError.invalid("只能删除应用内的漫画副本。")
                }
                try fm.removeItem(at: file)
            }
        }
    }
}
