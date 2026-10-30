import CryptoKit
import Foundation
import ImageIO
import UniformTypeIdentifiers
import ZIPFoundation

/// 仅由 ComicArchivePlugin 的串行工作队列调用，Archive 的文件指针不跨线程共享。
final class ComicStore {
    private let fm = FileManager.default
    private let cacheLimit = 500 * 1024 * 1024
    private var opened: (path: String, archive: Archive, entries: [Entry], directory: [ZipItem])?

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
        guard folder == "ComicLibrary" || folder == "ComicPrototype", stored.pathExtension == "zip",
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

    func inspect(_ path: String) throws -> [String: Any] {
        let url = try source(path)
        let directory = try ZipDirectory.read(url)
        return ["format": "zip", "encrypted": directory.contains(where: { $0.encrypted }),
                "entries": directory.map(\.json)]
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

    func render(path: String, bookId: String, index: Int, maxPixel: Int) throws -> [String: Any] {
        guard UUID(uuidString: bookId) != nil,
              URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent == bookId else {
            throw ComicError.invalid("漫画标识无效。")
        }
        let sourceURL = try source(path)
        let root = try cacheRoot()
        let requested = min(8192, max(256, maxPixel))
        let cache = root.appendingPathComponent("\(bookId)-\(index)-\(requested).png")
        let metadata = cache.appendingPathExtension("json")
        if fm.fileExists(atPath: cache.path),
           let data = try? Data(contentsOf: metadata),
           var result = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] {
            try? fm.setAttributes([.modificationDate: Date()], ofItemAtPath: cache.path)
            result["url"] = cache.absoluteString
            result["cached"] = true
            return result
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
        guard let image = CGImageSourceCreateThumbnailAtIndex(imageSource, 0, options as CFDictionary),
              let destination = CGImageDestinationCreateWithURL(cache as CFURL, UTType.png.identifier as CFString, 1, nil)
        else { throw ComicError.invalid("无法生成漫画预览。") }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else {
            try? fm.removeItem(at: cache)
            throw ComicError.invalid("页面缓存写入失败，请检查可用空间。")
        }
        let result: [String: Any] = ["width": image.width, "height": image.height,
                                    "sourceWidth": sourceWidth, "sourceHeight": sourceHeight]
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
    }

    /// 与渲染同一串行队列，先释放归档句柄；固定目录和 UUID，不接受任意路径。
    func disposeBook(bookId: String, deleteCopy: Bool) throws {
        guard UUID(uuidString: bookId) != nil else { throw ComicError.invalid("漫画标识无效。") }
        opened = nil
        try clearCache(bookId: bookId)
        guard deleteCopy else { return }
        let root = try Self.libraryRoot(prototype: false).resolvingSymlinksInPath().standardizedFileURL
        for suffix in ["zip", "part"] {
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
