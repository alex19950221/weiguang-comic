import Foundation

/// 只保存系统文件选择授权；不复制、写入或删除用户原件。书签不会进入整机备份。
enum ComicReferences {
    private struct Record: Codable {
        var bookmark: Data
        let size: Int
        let modified: Date?
        let format: String
    }
    private static let lock = NSRecursiveLock()
    private static let unavailable = "原文件不可用或已改变，请重新选择同一文件。"

    private static func attributes(_ source: URL) throws -> URLResourceValues {
        var url = source
        // URL 会缓存资源值；重新授权必须读取文件当前的大小与修改时间。
        url.removeAllCachedResourceValues()
        return try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey,
                                               .fileSizeKey, .contentModificationDateKey])
    }

    static func path(_ id: String) -> String { "comic-reference://" + id }

    private static func format(_ url: URL) -> String {
        let suffix = url.pathExtension.lowercased()
        return suffix == "cbz" ? "zip" : suffix
    }

    static func id(_ path: String) -> String? {
        let prefix = "comic-reference://"
        guard path.hasPrefix(prefix) else { return nil }
        let id = String(path.dropFirst(prefix.count))
        return UUID(uuidString: id) != nil ? id : nil
    }

    private static func file(_ id: String) throws -> URL {
        guard UUID(uuidString: id) != nil else { throw ComicError.invalid("漫画标识无效。") }
        let base = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        var root = base.appendingPathComponent("ComicReferences", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try root.setResourceValues(values)
        return root.appendingPathComponent(id + ".json")
    }

    private static func coordinated<T>(_ url: URL, _ work: (URL) throws -> T) throws -> T {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var result: Result<T, Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges,
                                       error: &coordinationError) { source in
            result = Result { try work(source) }
        }
        if let error = coordinationError { throw error }
        guard let result else { throw ComicError.invalid(unavailable) }
        return try result.get()
    }

    /// iOS 使用隐式 security scope 的 minimalBookmark；不使用仅 macOS 的 withSecurityScope。
    static func remember(_ source: URL, bookId: String, expectedFingerprint: String? = nil,
                         expectedFormat: String? = nil) throws -> [String: Any] {
        lock.lock()
        defer { lock.unlock() }
        let destination = try file(bookId)
        return try coordinated(source) { url in
            let values = try attributes(url)
            guard values.isRegularFile == true, values.isSymbolicLink != true,
                  ["zip", "cbz", "pdf", "epub"].contains(url.pathExtension.lowercased()),
                  let size = values.fileSize, size > 0 else { throw ComicError.invalid(unavailable) }
            if let expected = expectedFingerprint {
                let previous = try? JSONDecoder().decode(Record.self, from: Data(contentsOf: destination))
                if let expectedFormat = expectedFormat ?? previous?.format,
                   format(url) != expectedFormat { throw ComicError.invalid(unavailable) }
                let actual = try ComicStore.fingerprintURL(url)
                guard actual["sha256"] as? String == expected.lowercased() else {
                    throw ComicError.invalid("所选文件与原书不同，阅读记录已保留，请选择原文件。")
                }
            } else if FileManager.default.fileExists(atPath: destination.path) {
                throw ComicError.invalid("漫画引用已经存在。")
            }
            let data = try source.bookmarkData(options: .minimalBookmark,
                                                includingResourceValuesForKeys: nil, relativeTo: nil)
            let record = Record(bookmark: data, size: size, modified: values.contentModificationDate, format: format(url))
            try JSONEncoder().encode(record).write(to: destination, options: .atomic)
            return ["path": path(bookId), "size": size]
        }
    }

    static func withURL<T>(_ path: String, _ work: (URL) throws -> T) throws -> T {
        lock.lock()
        defer { lock.unlock() }
        guard let id = id(path) else { throw ComicError.invalid(unavailable) }
        do {
            let destination = try file(id)
            var record = try JSONDecoder().decode(Record.self, from: Data(contentsOf: destination))
            var stale = false
            let url = try URL(resolvingBookmarkData: record.bookmark, options: [.withoutUI, .withoutImplicitStartAccessing],
                              relativeTo: nil, bookmarkDataIsStale: &stale)
            return try coordinated(url) { source in
                let values = try attributes(source)
                guard values.isRegularFile == true, values.isSymbolicLink != true,
                      values.fileSize == record.size, values.contentModificationDate == record.modified,
                      format(source) == record.format else {
                    throw ComicError.invalid(unavailable)
                }
                if stale {
                    record.bookmark = try url.bookmarkData(options: .minimalBookmark,
                                                           includingResourceValuesForKeys: nil, relativeTo: nil)
                    try JSONEncoder().encode(record).write(to: destination, options: .atomic)
                }
                return try work(source)
            }
        } catch {
            throw ComicError.invalid(unavailable)
        }
    }

    static func remove(_ id: String) throws {
        lock.lock()
        defer { lock.unlock() }
        let url = try file(id)
        if FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) }
    }
}
