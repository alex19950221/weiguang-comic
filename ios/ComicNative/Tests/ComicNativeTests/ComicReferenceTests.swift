import Foundation
import UIKit
import XCTest
import ZIPFoundation
@testable import ComicNative

final class ComicReferenceTests: XCTestCase {
    private func pdf() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".PDF")
        try UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 200, height: 400)).writePDF(to: url) { context in
            context.beginPage()
            UIColor.black.setFill()
            UIRectFill(CGRect(x: 10, y: 10, width: 180, height: 380))
        }
        return url
    }

    func testPersistsPDFReferenceRendersWithoutCopyAndNeverDeletesOriginal() throws {
        let original = try pdf()
        let bytes = try Data(contentsOf: original)
        let id = UUID().uuidString
        defer { try? FileManager.default.removeItem(at: original); try? ComicReferences.remove(id) }
        let path = try XCTUnwrap(ComicReferences.remember(original, bookId: id)["path"] as? String)
        // 新 Store 实例从持久书签恢复，并支持原件大写扩展名。
        let store = ComicStore()
        XCTAssertEqual(try store.inspect(path)["format"] as? String, "pdf")
        XCTAssertEqual(try store.render(path: path, bookId: id, index: 0, maxPixel: 400)["height"] as? Int, 400)
        XCTAssertFalse(FileManager.default.fileExists(atPath: try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".pdf").path))
        try store.disposeBook(bookId: id, deleteCopy: false)
        XCTAssertThrowsError(try ComicStore().inspect(path))
        XCTAssertEqual(try Data(contentsOf: original), bytes)
    }

    func testReadsZIPCBZAndEpubOriginals() throws {
        for suffix in ["zip", "cbz", "epub"] {
            let original = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "." + suffix)
            let id = UUID().uuidString
            defer { try? FileManager.default.removeItem(at: original); try? ComicReferences.remove(id) }
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            let image = UIGraphicsImageRenderer(size: CGSize(width: 100, height: 200), format: format).pngData { context in
                UIColor.black.setFill(); context.fill(CGRect(x: 0, y: 0, width: 100, height: 200))
            }
            do {
                let archive = try Archive(url: original, accessMode: .create)
                try archive.addEntry(with: "1.png", type: .file, uncompressedSize: Int64(image.count),
                                     provider: { position, size in image.subdata(in: Int(position)..<Int(position) + size) })
            }
            let path = try XCTUnwrap(ComicReferences.remember(original, bookId: id)["path"] as? String)
            XCTAssertEqual(try ComicStore().inspect(path)["format"] as? String, suffix == "epub" ? "epub" : "zip")
            XCTAssertEqual(try ComicStore().render(path: path, bookId: id, index: 0, maxPixel: 400)["sourceHeight"] as? Int, 200)
            try ComicStore().disposeBook(bookId: id, deleteCopy: false)
            XCTAssertTrue(FileManager.default.fileExists(atPath: original.path))
        }
    }

    func testMissingOriginalCannotServePreviouslyCachedPage() throws {
        let original = try pdf()
        let id = UUID().uuidString
        defer { try? FileManager.default.removeItem(at: original); try? ComicReferences.remove(id) }
        let path = ComicReferences.path(id)
        _ = try ComicReferences.remember(original, bookId: id)
        let store = ComicStore()
        _ = try store.render(path: path, bookId: id, index: 0, maxPixel: 400)
        try FileManager.default.removeItem(at: original)
        XCTAssertThrowsError(try store.render(path: path, bookId: id, index: 0, maxPixel: 400))
        try store.disposeBook(bookId: id, deleteCopy: false)
    }

    func testChangedOriginalRequiresReselectionAndWrongFileKeepsPreviousReference() throws {
        let original = try pdf()
        let wrong = try pdf()
        let id = UUID().uuidString
        defer { try? FileManager.default.removeItem(at: original); try? FileManager.default.removeItem(at: wrong); try? ComicReferences.remove(id) }
        _ = try ComicReferences.remember(original, bookId: id)
        let path = ComicReferences.path(id)
        let fingerprint = try XCTUnwrap(ComicStore().fingerprint(path)["sha256"] as? String)
        try Data("different".utf8).write(to: wrong)
        XCTAssertThrowsError(try ComicReferences.remember(wrong, bookId: id, expectedFingerprint: fingerprint))
        XCTAssertEqual(try ComicStore().fingerprint(path)["sha256"] as? String, fingerprint)
        try FileManager.default.setAttributes([.modificationDate: Date(timeIntervalSince1970: 1234)], ofItemAtPath: original.path)
        XCTAssertThrowsError(try ComicStore().inspect(path))
        _ = try ComicReferences.remember(original, bookId: id, expectedFingerprint: fingerprint)
        XCTAssertEqual(try ComicStore().inspect(path)["format"] as? String, "pdf")
    }

    func testRejectsArbitraryPathsSymbolicLinksAndMismatchedBookIdentity() throws {
        let original = try pdf()
        let link = original.deletingLastPathComponent().appendingPathComponent(UUID().uuidString + ".pdf")
        let id = UUID().uuidString
        defer { try? FileManager.default.removeItem(at: original); try? FileManager.default.removeItem(at: link); try? ComicReferences.remove(id) }
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: original)
        XCTAssertThrowsError(try ComicReferences.remember(link, bookId: id))
        XCTAssertThrowsError(try ComicStore().inspect(original.path))
        XCTAssertThrowsError(try ComicReferences.withURL("comic-reference://../arbitrary") { $0 })
        _ = try ComicReferences.remember(original, bookId: id)
        XCTAssertThrowsError(try ComicStore().render(path: ComicReferences.path(id), bookId: UUID().uuidString, index: 0, maxPixel: 400))
    }

    func testRenamingToAnotherFormatCannotChangeAnExistingBooksDecoder() throws {
        let original = try pdf()
        let renamed = original.deletingPathExtension().appendingPathExtension("zip")
        let id = UUID().uuidString
        defer { try? FileManager.default.removeItem(at: original); try? FileManager.default.removeItem(at: renamed); try? ComicReferences.remove(id) }
        _ = try ComicReferences.remember(original, bookId: id)
        let path = ComicReferences.path(id)
        let fingerprint = try XCTUnwrap(ComicStore().fingerprint(path)["sha256"] as? String)
        try FileManager.default.copyItem(at: original, to: renamed)
        XCTAssertThrowsError(try ComicReferences.remember(renamed, bookId: id, expectedFingerprint: fingerprint, expectedFormat: "pdf"))
        XCTAssertEqual(try ComicStore().inspect(path)["format"] as? String, "pdf")
    }
}
