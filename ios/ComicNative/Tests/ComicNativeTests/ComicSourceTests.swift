import Foundation
import XCTest
@testable import ComicNative

final class ComicSourceTests: XCTestCase {
    /// 网页数据库保存的是导入时的绝对路径；应用更新后容器 UUID 变化，仍应找到当前容器里的副本。
    func testRelocatesCopiesSavedUnderAnOlderAppContainer() throws {
        let store = ComicStore()
        let id = UUID().uuidString
        let old = "/var/mobile/Containers/Data/Application/\(UUID().uuidString)/Library/Application Support"
        let library = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".zip")
        let prototype = try ComicStore.libraryRoot().appendingPathComponent(id + ".zip")
        XCTAssertEqual(try store.source("\(old)/ComicLibrary/\(id).zip").path, library.path)
        XCTAssertEqual(try store.source("\(old)/ComicPrototype/\(id).zip").path, prototype.path)
        XCTAssertEqual(try store.source(library.path).path, library.path)
    }

    func testRejectsOtherFoldersNamesAndSymbolicLinks() throws {
        let store = ComicStore()
        let id = UUID().uuidString
        XCTAssertThrowsError(try store.source("/tmp/\(id).zip"))
        XCTAssertThrowsError(try store.source("/tmp/ComicLibrary/../\(id).zip"))
        XCTAssertThrowsError(try store.source("/tmp/ComicLibrary/book.zip"))
        XCTAssertThrowsError(try store.source("/tmp/ComicLibrary/\(id).part"))
        let target = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let link = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".zip")
        defer { try? FileManager.default.removeItem(at: link); try? FileManager.default.removeItem(at: target) }
        try Data([5, 6]).write(to: target)
        try FileManager.default.createSymbolicLink(at: link, withDestinationURL: target)
        XCTAssertThrowsError(try store.source(link.path))
    }
}
