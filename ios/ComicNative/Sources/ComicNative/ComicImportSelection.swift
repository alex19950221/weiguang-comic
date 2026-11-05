import Foundation

/// 系统文件选择器不保证多选回调的顺序；以文件名自然排序统一同批导入顺序。
enum ComicImportSelection {
    static func ordered(_ urls: [URL]) -> [URL] {
        urls.sorted { left, right in
            let order = left.lastPathComponent.compare(
                right.lastPathComponent,
                options: [.numeric, .caseInsensitive],
                locale: Locale(identifier: "en_US_POSIX")
            )
            if order != .orderedSame { return order == .orderedAscending }
            return left.absoluteString < right.absoluteString
        }
    }
}
