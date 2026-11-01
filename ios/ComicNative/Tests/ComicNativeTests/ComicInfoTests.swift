import Foundation
import XCTest
import ZIPFoundation
@testable import ComicNative

final class ComicInfoTests: XCTestCase {
    /// 写一份带一张图片条目的测试包到 ComicLibrary；可选放入根目录 ComicInfo.xml。
    private func makeArchive(xml: String?) throws -> (id: String, file: URL) {
        let id = UUID().uuidString
        let file = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".zip")
        let archive = try Archive(url: file, accessMode: .create)
        let page = Data([0x01, 0x02])
        try archive.addEntry(with: "1.jpg", type: .file, uncompressedSize: Int64(page.count),
                             provider: { _, _ in page })
        if let xml {
            let data = Data(xml.utf8)
            try archive.addEntry(with: "ComicInfo.xml", type: .file,
                                 uncompressedSize: Int64(data.count), provider: { _, _ in data })
        }
        return (id, file)
    }

    func testDetectsRightToLeftMangaMarker() throws {
        let (_, file) = try makeArchive(
            xml: """
            <?xml version="1.0"?><ComicInfo><Manga>YesAndRightToLeft</Manga></ComicInfo>
            """)
        defer { try? FileManager.default.removeItem(at: file) }
        let inspection = try ComicStore().inspect(file.path)
        XCTAssertEqual(inspection["format"] as? String, "zip")
        XCTAssertEqual(inspection["manga"] as? String, "rtl")
    }

    func testIgnoresMissingOrLeftToRightMarker() throws {
        let (_, plain) = try makeArchive(xml: nil)
        defer { try? FileManager.default.removeItem(at: plain) }
        XCTAssertNil(try ComicStore().inspect(plain.path)["manga"])

        let (_, ltr) = try makeArchive(
            xml: "<?xml version=\"1.0\"?><ComicInfo><Manga>No</Manga></ComicInfo>")
        defer { try? FileManager.default.removeItem(at: ltr) }
        XCTAssertNil(try ComicStore().inspect(ltr.path)["manga"])
    }
}
