import Foundation
import XCTest
@testable import ComicNative

final class ZipDirectoryTests: XCTestCase {
    private func fields(_ values: [(UInt64, Int)]) -> Data {
        Data(values.flatMap { value, count in
            (0..<count).map { UInt8(truncatingIfNeeded: value >> ($0 * 8)) }
        })
    }

    /// 自建两个字节内容的小包，不依赖真实漫画或外部工具。
    private func archive(name: Data = Data("2.jpg".utf8), flags: UInt64 = 0x800,
                         zip64: Bool = false, localOffset: UInt64 = 0) -> Data {
        let local = fields([(0x04034b50, 4), (20, 2), (flags, 2), (0, 2), (0, 2), (0, 2),
                            (0, 4), (2, 4), (2, 4), (UInt64(name.count), 2), (0, 2)]) + name + Data([1, 2])
        let extra = zip64 ? fields([(1, 2), (24, 2), (2, 8), (2, 8), (localOffset, 8)]) : Data()
        let central = fields([
            (0x02014b50, 4), (0x314, 2), (zip64 ? 45 : 20, 2), (flags, 2), (0, 2), (0, 2), (0, 2),
            (0, 4), (zip64 ? 0xffffffff : 2, 4), (zip64 ? 0xffffffff : 2, 4),
            (UInt64(name.count), 2), (UInt64(extra.count), 2), (0, 2), (0, 2), (0, 2), (0, 4),
            (zip64 ? 0xffffffff : localOffset, 4)
        ]) + name + extra
        var result = local + central
        if zip64 {
            let recordOffset = UInt64(result.count)
            result += fields([(0x06064b50, 4), (44, 8), (45, 2), (45, 2), (0, 4), (0, 4),
                              (1, 8), (1, 8), (UInt64(central.count), 8), (UInt64(local.count), 8)])
            result += fields([(0x07064b50, 4), (0, 4), (recordOffset, 8), (1, 4)])
        }
        result += fields([(0x06054b50, 4), (0, 2), (0, 2), (zip64 ? 0xffff : 1, 2),
                          (zip64 ? 0xffff : 1, 2), (zip64 ? 0xffffffff : UInt64(central.count), 4),
                          (zip64 ? 0xffffffff : UInt64(local.count), 4), (0, 2)])
        return result
    }

    private func read(_ data: Data) throws -> [ZipItem] {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".zip")
        try data.write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }
        return try ZipDirectory.read(url)
    }

    func testReadsPlainZipAndPreservesIndex() throws {
        let items = try read(archive())
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].index, 0)
        XCTAssertEqual(items[0].size, 2)
        XCTAssertEqual(items[0].json["name"] as? String, "2.jpg")
    }

    func testReadsZip64MarkersAndExtraFields() throws {
        let items = try read(archive(zip64: true))
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items[0].size, 2)
        XCTAssertEqual(items[0].localOffset, 0)
    }

    func testPreservesLegacyBytesAndDetectsEncryption() throws {
        let raw = Data([0xd6, 0xd0, 0xce, 0xc4, 46, 106, 112, 103])
        let item = try XCTUnwrap(read(archive(name: raw, flags: 1)).first)
        XCTAssertTrue(item.encrypted)
        XCTAssertEqual(item.json["rawName"] as? String, raw.base64EncodedString())
        XCTAssertNil(item.json["name"])
    }

    func testRejectsTruncationAndOutOfBoundsLocalHeader() throws {
        XCTAssertThrowsError(try read(Data(archive().dropLast())))
        XCTAssertThrowsError(try read(archive(localOffset: 0xfffffffe)))
        XCTAssertThrowsError(try read(Data(repeating: 0, count: 100)))
    }
}
