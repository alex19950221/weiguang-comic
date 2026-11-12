import Foundation
import XCTest
@testable import ComicNative

final class ComicOpenedFilesTests: XCTestCase {
    func testOnlySandboxInboxFilesCountAsDisposable() {
        let home = "/var/mobile/Containers/Data/Application/APP"
        let inbox = URL(fileURLWithPath: home + "/Documents/Inbox/vol1.cbz")
        let tmpInbox = URL(fileURLWithPath: home + "/tmp/dev.weiguang.comic-Inbox/vol1.pdf")
        XCTAssertTrue(ComicOpenedFiles.isInbox(inbox, home: home))
        XCTAssertTrue(ComicOpenedFiles.isInbox(tmpInbox, home: home))
        // 文件选择器给的原件、其他 App 的 Inbox、借路径穿越出沙盒的文件都不能删。
        XCTAssertFalse(ComicOpenedFiles.isInbox(URL(fileURLWithPath: home + "/Documents/vol1.cbz"), home: home))
        XCTAssertFalse(ComicOpenedFiles.isInbox(URL(fileURLWithPath: "/private/var/mobile/Library/Mobile Documents/Inbox/vol1.cbz"), home: home))
        XCTAssertFalse(ComicOpenedFiles.isInbox(URL(fileURLWithPath: home + "/Documents/Inbox/../../../OTHER/Inbox/a.cbz"), home: home))
        XCTAssertFalse(ComicOpenedFiles.isInbox(URL(fileURLWithPath: home + "/Documents/NotInbox/a.cbz"), home: home))
        XCTAssertFalse(ComicOpenedFiles.isInbox(URL(string: "https://example.com/Inbox/a.cbz")!, home: home))
    }

    func testReceiveKeepsSupportedFilesInNaturalOrderAndTakeEmptiesQueue() {
        let files = ComicOpenedFiles()
        let urls = ["第10卷.cbz", "第2卷.PDF", "说明.txt", "第1卷.epub", "合集.zip"]
            .map { URL(fileURLWithPath: "/qa/\($0)") }
        files.receive(urls + [URL(string: "weiguang://open")!])
        XCTAssertEqual(files.take().map(\.lastPathComponent), ["合集.zip", "第1卷.epub", "第2卷.PDF", "第10卷.cbz"])
        XCTAssertTrue(files.take().isEmpty)
    }

    func testDiscardDeletesInboxCopyButNeverOtherFiles() throws {
        let home = NSHomeDirectory()
        let inbox = URL(fileURLWithPath: home).appendingPathComponent("tmp/qa-opened-Inbox", isDirectory: true)
        let outside = URL(fileURLWithPath: home).appendingPathComponent("tmp/qa-opened-original", isDirectory: true)
        let fm = FileManager.default
        try fm.createDirectory(at: inbox, withIntermediateDirectories: true)
        try fm.createDirectory(at: outside, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: inbox); try? fm.removeItem(at: outside) }
        let copy = inbox.appendingPathComponent("vol1.cbz")
        let original = outside.appendingPathComponent("vol1.cbz")
        try Data("copy".utf8).write(to: copy)
        try Data("original".utf8).write(to: original)
        ComicOpenedFiles.discard(copy)
        ComicOpenedFiles.discard(original)
        XCTAssertFalse(fm.fileExists(atPath: copy.path))
        XCTAssertTrue(fm.fileExists(atPath: original.path))
    }
}
