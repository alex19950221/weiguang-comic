import Foundation
import XCTest
import ZIPFoundation
@testable import ComicNative

final class EpubTests: XCTestCase {
    /// EPUB 按 ZIP 读取：inspect 交出 XML/XHTML 文本但不交出图片，图片页仍走 ZIP 渲染与删除。
    func testInspectsTextsAndDisposesEpubCopies() throws {
        let id = UUID().uuidString
        let file = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".epub")
        defer { try? FileManager.default.removeItem(at: file) }
        let archive = try Archive(url: file, accessMode: .create)
        let files: [(String, Data)] = [
            ("mimetype", Data("application/epub+zip".utf8)),
            ("META-INF/container.xml", Data("<container><rootfile full-path=\"content.opf\"/></container>".utf8)),
            ("content.opf", Data("<package><spine><itemref idref=\"p\"/></spine></package>".utf8)),
            ("p.xhtml", Data("<html><body><img src=\"1.jpg\"/></body></html>".utf8)),
            ("1.jpg", Data([0x01, 0x02]))
        ]
        for (name, data) in files {
            try archive.addEntry(with: name, type: .file, uncompressedSize: Int64(data.count),
                                 provider: { position, size in
                                     data.subdata(in: Int(position)..<Int(position) + size)
                                 })
        }
        let store = ComicStore()
        let inspection = try store.inspect(file.path)
        XCTAssertEqual(inspection["format"] as? String, "epub")
        XCTAssertEqual(inspection["encrypted"] as? Bool, false)
        XCTAssertEqual((inspection["entries"] as? [[String: Any]])?.count, 5)
        let texts = try XCTUnwrap(inspection["texts"] as? [[String: Any]])
        XCTAssertEqual(texts.compactMap { $0["index"] as? Int }, [1, 2, 3])
        XCTAssertEqual(texts.last?["text"] as? String, "<html><body><img src=\"1.jpg\"/></body></html>")
        XCTAssertNil(inspection["manga"])

        try store.disposeBook(bookId: id, deleteCopy: true)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
    }

    func testAcceptsEpubLibraryPaths() throws {
        let id = UUID().uuidString
        let library = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".epub")
        XCTAssertEqual(try ComicStore().source(library.path).path, library.path)
        XCTAssertThrowsError(try ComicStore().source("/tmp/ComicLibrary/\(id).mobi"))
    }
}
