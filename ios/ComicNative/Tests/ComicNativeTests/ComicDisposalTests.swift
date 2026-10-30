import Foundation
import XCTest
@testable import ComicNative

final class ComicDisposalTests: XCTestCase {
    func testDisposesOnlyTheSpecifiedLibraryCopyAndCanRetry() throws {
        let root = try ComicStore.libraryRoot(prototype: false)
        let prototype = try ComicStore.libraryRoot()
        let id = UUID().uuidString
        let otherID = UUID().uuidString
        let files = [root.appendingPathComponent(id + ".zip"), root.appendingPathComponent(id + ".part"),
                     root.appendingPathComponent(otherID + ".zip"), prototype.appendingPathComponent(id + ".zip")]
        defer { for file in files { try? FileManager.default.removeItem(at: file) } }
        for file in files { try Data([1, 2]).write(to: file) }
        let store = ComicStore()
        try store.disposeBook(bookId: id, deleteCopy: false)
        XCTAssertTrue(FileManager.default.fileExists(atPath: files[0].path))
        try store.disposeBook(bookId: id, deleteCopy: true)
        try store.disposeBook(bookId: id, deleteCopy: true)
        XCTAssertFalse(FileManager.default.fileExists(atPath: files[0].path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: files[1].path))
        XCTAssertEqual(try Data(contentsOf: files[2]), Data([1, 2]))
        XCTAssertEqual(try Data(contentsOf: files[3]), Data([1, 2]))
    }

    func testRejectsPathsAndSymbolicLinksWithoutTouchingTheTarget() throws {
        let store = ComicStore()
        XCTAssertThrowsError(try store.disposeBook(bookId: "../outside", deleteCopy: true))
        let id = UUID().uuidString
        let target = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let link = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".zip")
        defer { try? FileManager.default.removeItem(at: link); try? FileManager.default.removeItem(at: target) }
        try Data([3, 4]).write(to: target)
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: target)
        XCTAssertThrowsError(try store.disposeBook(bookId: id, deleteCopy: true))
        XCTAssertEqual(try Data(contentsOf: target), Data([3, 4]))
    }
}
