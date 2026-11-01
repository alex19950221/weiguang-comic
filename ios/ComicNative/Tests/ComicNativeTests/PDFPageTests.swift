import Foundation
import UIKit
import XCTest
@testable import ComicNative

final class PDFPageTests: XCTestCase {
    /// 生成一份两页 PDF（第二页横向），确认页数、页序、按请求尺寸渲染与删除副本。
    func testInspectsRendersAndDisposesPDFCopies() throws {
        let id = UUID().uuidString
        let file = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".pdf")
        defer { try? FileManager.default.removeItem(at: file) }
        let portrait = CGRect(x: 0, y: 0, width: 300, height: 600)
        let renderer = UIGraphicsPDFRenderer(bounds: portrait)
        try renderer.writePDF(to: file) { context in
            context.beginPage()
            UIColor.black.setFill()
            UIRectFill(CGRect(x: 0, y: 0, width: 300, height: 300))
            context.beginPage(withBounds: CGRect(x: 0, y: 0, width: 800, height: 400), pageInfo: [:])
        }
        let store = ComicStore()
        let inspection = try store.inspect(file.path)
        XCTAssertEqual(inspection["format"] as? String, "pdf")
        XCTAssertEqual(inspection["encrypted"] as? Bool, false)
        let entries = try XCTUnwrap(inspection["entries"] as? [[String: Any]])
        XCTAssertEqual(entries.compactMap { $0["index"] as? Int }, [0, 1])

        let first = try store.render(path: file.path, bookId: id, index: 0, maxPixel: 1200)
        XCTAssertEqual(first["height"] as? Int, 1200)
        XCTAssertEqual(first["width"] as? Int, 600)
        XCTAssertEqual(first["sourceWidth"] as? Int, 300)
        let second = try store.render(path: file.path, bookId: id, index: 1, maxPixel: 400)
        XCTAssertEqual(second["width"] as? Int, 400)
        XCTAssertEqual(second["height"] as? Int, 200)
        XCTAssertThrowsError(try store.render(path: file.path, bookId: id, index: 2, maxPixel: 400))

        try store.disposeBook(bookId: id, deleteCopy: true)
        XCTAssertFalse(FileManager.default.fileExists(atPath: file.path))
    }

    func testRejectsFilesThatAreNotPDF() throws {
        let id = UUID().uuidString
        let file = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".pdf")
        defer { try? FileManager.default.removeItem(at: file) }
        try Data("not a pdf".utf8).write(to: file)
        XCTAssertThrowsError(try ComicStore().inspect(file.path))
    }
}
