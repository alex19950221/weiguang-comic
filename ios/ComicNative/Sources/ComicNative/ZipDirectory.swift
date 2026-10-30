import Foundation

enum ComicError: LocalizedError {
    case invalid(String)
    var errorDescription: String? {
        switch self { case .invalid(let message): return message }
    }
}

struct ZipItem {
    let index: Int
    let rawName: Data
    let utf8: Bool
    let encrypted: Bool
    let size: UInt64
    let localOffset: UInt64
    let directory: Bool
    let symlink: Bool

    var json: [String: Any] {
        var result: [String: Any] = [
            "index": index, "size": size, "isDirectory": directory, "isSymlink": symlink
        ]
        if utf8, let name = String(data: rawName, encoding: .utf8) {
            result["name"] = name
        } else {
            result["rawName"] = rawName.base64EncodedString()
        }
        return result
    }
}

/// 只读取中央目录，保留原始文件名字节。ZIPFoundation 会跳过加密条目，
/// 因此不能仅凭它的 Sequence 判定一个包是否完整、是否加密。
enum ZipDirectory {
    private static let maxEntries: UInt64 = 100_000
    private static let maxNameBytes = 16 * 1024 * 1024

    static func read(_ url: URL) throws -> [ZipItem] {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        let size = try file.seekToEnd()
        guard size >= 22 else { throw ComicError.invalid("不是有效的 ZIP 文件。") }
        let tailOffset = size - min(size, 65_557)
        let tail = try read(file, at: tailOffset, count: Int(size - tailOffset))
        var end: Int?
        for offset in stride(from: tail.count - 22, through: 0, by: -1) {
            if tail.u32(offset) == 0x06054b50,
               offset + 22 + Int(tail.u16(offset + 20)) == tail.count {
                end = offset
                break
            }
        }
        guard let end else { throw ComicError.invalid("ZIP 目录缺失或文件已损坏。") }
        guard tail.u16(end + 4) == 0, tail.u16(end + 6) == 0,
              tail.u16(end + 8) == tail.u16(end + 10) else {
            throw ComicError.invalid("暂不支持分卷 ZIP。")
        }
        var count = UInt64(tail.u16(end + 10))
        var directorySize = UInt64(tail.u32(end + 12))
        var directoryOffset = UInt64(tail.u32(end + 16))
        var directoryLimit = tailOffset + UInt64(end)
        if count == 0xffff || directoryOffset == 0xffffffff || directorySize == 0xffffffff {
            guard directoryLimit >= 20 else { throw ComicError.invalid("ZIP64 目录无效。") }
            let locator = try read(file, at: directoryLimit - 20, count: 20)
            guard locator.u32(0) == 0x07064b50, locator.u32(4) == 0, locator.u32(16) == 1 else {
                throw ComicError.invalid("ZIP64 分卷或目录不受支持。")
            }
            let zip64Offset = locator.u64(8)
            guard zip64Offset <= directoryLimit - 20, directoryLimit - 20 - zip64Offset >= 56 else {
                throw ComicError.invalid("ZIP64 目录越界。")
            }
            let record = try read(file, at: zip64Offset, count: 56)
            guard record.u32(0) == 0x06064b50, record.u64(4) >= 44,
                  record.u64(4) <= directoryLimit - 20 - zip64Offset - 12,
                  record.u32(16) == 0, record.u32(20) == 0, record.u64(24) == record.u64(32) else {
                throw ComicError.invalid("ZIP64 目录已损坏。")
            }
            count = record.u64(32)
            directorySize = record.u64(40)
            directoryOffset = record.u64(48)
            directoryLimit = zip64Offset
        }
        guard count <= maxEntries, directoryOffset <= directoryLimit,
              directorySize <= directoryLimit - directoryOffset,
              count <= directorySize / 46 else {
            throw ComicError.invalid("ZIP 目录越界或条目过多（上限十万）。")
        }
        let directoryEnd = directoryOffset + directorySize
        var cursor = directoryOffset
        var nameBytes = 0
        var items: [ZipItem] = []
        for index in 0..<Int(count) {
            guard cursor <= directoryEnd, directoryEnd - cursor >= 46 else {
                throw ComicError.invalid("ZIP 目录已截断。")
            }
            let header = try read(file, at: cursor, count: 46)
            guard header.u32(0) == 0x02014b50 else { throw ComicError.invalid("ZIP 条目无效。") }
            let nameLength = Int(header.u16(28))
            let extraLength = Int(header.u16(30))
            let length = 46 + nameLength + extraLength + Int(header.u16(32))
            nameBytes += nameLength
            guard UInt64(length) <= directoryEnd - cursor, nameBytes <= maxNameBytes,
                  header.u16(34) == 0 else {
                throw ComicError.invalid("ZIP 条目越界、文件名过多或包含分卷。")
            }
            let payload = try read(file, at: cursor + 46, count: nameLength + extraLength)
            let name = payload.subdata(in: 0..<nameLength)
            let extra = payload.subdata(in: nameLength..<(nameLength + extraLength))
            var entrySize = UInt64(header.u32(24))
            var localOffset = UInt64(header.u32(42))
            if entrySize == 0xffffffff || header.u32(20) == 0xffffffff || localOffset == 0xffffffff {
                var field = 0
                var found = false
                while field + 4 <= extra.count {
                    let fieldSize = Int(extra.u16(field + 2))
                    guard fieldSize <= extra.count - field - 4 else { break }
                    if extra.u16(field) == 1 {
                        var position = field + 4
                        let limit = position + fieldSize
                        func next() throws -> UInt64 {
                            guard position + 8 <= limit else { throw ComicError.invalid("ZIP64 条目缺失。") }
                            defer { position += 8 }
                            return extra.u64(position)
                        }
                        if entrySize == 0xffffffff { entrySize = try next() }
                        if header.u32(20) == 0xffffffff { _ = try next() }
                        if localOffset == 0xffffffff { localOffset = try next() }
                        found = true
                        break
                    }
                    field += 4 + fieldSize
                }
                guard found else { throw ComicError.invalid("ZIP64 条目缺失。") }
            }
            guard localOffset < directoryOffset else { throw ComicError.invalid("ZIP 页面位置越界。") }
            let flags = header.u16(8)
            let unix = header.u16(4) >> 8 == 3 || header.u16(4) >> 8 == 19
            let mode = header.u32(38) >> 16
            items.append(ZipItem(
                index: index, rawName: name, utf8: flags & 0x800 != 0,
                encrypted: flags & 0x41 != 0, size: entrySize, localOffset: localOffset,
                directory: name.last == 47 || (unix && mode & 0xf000 == 0x4000),
                symlink: unix && mode & 0xf000 == 0xa000
            ))
            cursor += UInt64(length)
        }
        return items
    }

    private static func read(_ file: FileHandle, at offset: UInt64, count: Int) throws -> Data {
        try file.seek(toOffset: offset)
        guard let data = try file.read(upToCount: count), data.count == count else {
            throw ComicError.invalid("ZIP 文件已截断。")
        }
        return data
    }
}

private extension Data {
    func u16(_ at: Int) -> UInt16 { UInt16(self[at]) | UInt16(self[at + 1]) << 8 }
    func u32(_ at: Int) -> UInt32 { UInt32(u16(at)) | UInt32(u16(at + 2)) << 16 }
    func u64(_ at: Int) -> UInt64 { UInt64(u32(at)) | UInt64(u32(at + 4)) << 32 }
}
