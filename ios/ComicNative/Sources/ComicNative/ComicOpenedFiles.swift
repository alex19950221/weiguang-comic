import Foundation

/// 从其他 App「用…打开」或分享到本应用的文件。
///
/// Info.plist 设了 `LSSupportsOpeningDocumentsInPlace = NO`，系统先把文件复制进本应用的 Inbox
/// （`Documents/Inbox` 或 `tmp/<bundle>-Inbox`），再把副本 URL 交给场景代理。这里只在主线程暂存 URL，
/// 由 ComicImportPlugin 换成临时标识交给网页导入；导入结束释放标识时删除 Inbox 副本，原文件不受影响。
public final class ComicOpenedFiles {
    public static let shared = ComicOpenedFiles()
    static let didReceive = Notification.Name("dev.weiguang.comic.openedFiles")
    static let formats: Set<String> = ["zip", "cbz", "pdf", "epub"]

    private var pending: [URL] = []

    /// 场景代理在主线程调用，冷启动时要早于创建桥接视图控制器，避免 Inbox 清理误删刚收到的文件。
    public func receive(_ urls: [URL]) {
        var accepted: [URL] = []
        for url in urls where url.isFileURL {
            if Self.formats.contains(url.pathExtension.lowercased()) {
                accepted.append(url)
            } else if Self.isInbox(url) {
                try? FileManager.default.removeItem(at: url)
            }
        }
        guard !accepted.isEmpty else { return }
        pending.append(contentsOf: accepted)
        NotificationCenter.default.post(name: Self.didReceive, object: nil)
    }

    /// 取走全部待导入文件，同批按文件名自然排序。
    func take() -> [URL] {
        defer { pending.removeAll() }
        return ComicImportSelection.ordered(pending)
    }

    /// 只认本应用沙盒里名为 Inbox / *-Inbox 的目录中的文件，其他位置一律不删。
    static func isInbox(_ url: URL, home: String = NSHomeDirectory()) -> Bool {
        guard url.isFileURL else { return false }
        let path = url.standardizedFileURL.resolvingSymlinksInPath().path
        let root = URL(fileURLWithPath: home).standardizedFileURL.resolvingSymlinksInPath().path
        let folder = url.deletingLastPathComponent().lastPathComponent
        return path.hasPrefix(root + "/") && (folder == "Inbox" || folder.hasSuffix("-Inbox"))
    }

    /// 释放标识时删除 Inbox 副本；不是 Inbox 里的文件（例如文件选择器给的原件）绝不删除。
    static func discard(_ url: URL) {
        guard isInbox(url) else { return }
        try? FileManager.default.removeItem(at: url)
    }

    /// 启动时清理上次进程收到却没导入的 Inbox 副本，仍待导入的文件保留。
    func sweepInbox() {
        let fm = FileManager.default
        var folders: [URL] = []
        if let documents = fm.urls(for: .documentDirectory, in: .userDomainMask).first {
            folders.append(documents.appendingPathComponent("Inbox", isDirectory: true))
        }
        let temporary = fm.temporaryDirectory
        let entries = (try? fm.contentsOfDirectory(at: temporary, includingPropertiesForKeys: nil)) ?? []
        folders += entries.filter { $0.lastPathComponent.hasSuffix("-Inbox") }
        let keep = Set(pending.map { $0.standardizedFileURL.resolvingSymlinksInPath().path })
        for folder in folders {
            for item in (try? fm.contentsOfDirectory(at: folder, includingPropertiesForKeys: nil)) ?? []
            where !keep.contains(item.standardizedFileURL.resolvingSymlinksInPath().path) {
                Self.discard(item)
            }
        }
    }
}
