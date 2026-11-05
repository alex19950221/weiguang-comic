import Foundation
import XCTest
@testable import ComicNative

final class ComicImportSelectionTests: XCTestCase {
    func testPickerOrderDoesNotReverseVolumesOrSortTenBeforeTwo() {
        let urls = ["第10卷.cbz", "第02卷.zip", "第01卷.cbz", "第3卷.pdf"]
            .map { URL(fileURLWithPath: "/qa/\($0)") }
        let expected = ["第01卷.cbz", "第02卷.zip", "第3卷.pdf", "第10卷.cbz"]
        XCTAssertEqual(ComicImportSelection.ordered(urls).map(\.lastPathComponent), expected)
        XCTAssertEqual(ComicImportSelection.ordered(Array(urls.reversed())).map(\.lastPathComponent), expected)
    }

    func testEquivalentNamesHaveStableOrderWithoutDroppingSelections() {
        let urls = ["/b/vol01.cbz", "/a/Vol1.cbz", "/a/vol01.cbz"]
            .map { URL(fileURLWithPath: $0) }
        let forward = ComicImportSelection.ordered(urls)
        XCTAssertEqual(forward, ComicImportSelection.ordered(Array(urls.reversed())))
        XCTAssertEqual(Set(forward), Set(urls))
        XCTAssertEqual(forward.count, urls.count)
        XCTAssertTrue(ComicImportSelection.ordered([]).isEmpty)
    }
}
