import CoreImage
import Foundation
import UIKit
import XCTest
import ZIPFoundation
@testable import ComicNative

final class PageFiltersTests: XCTestCase {
    private let context = CIContext(options: [.useSoftwareRenderer: true])
    private func filters(_ contrast: Int = 100, _ sharpness: Int = 0, _ warmth: Int = 0) throws -> PageFilters {
        try PageFilters.parse(["contrast": contrast, "sharpness": sharpness, "warmth": warmth])
    }
    private func page() throws -> CGImage {
        let context = try XCTUnwrap(CGContext(data: nil, width: 80, height: 80, bitsPerComponent: 8,
                                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
        context.setFillColor(gray: 0.4, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: 40, height: 80))
        context.setFillColor(gray: 0.6, alpha: 1)
        context.fill(CGRect(x: 40, y: 0, width: 40, height: 80))
        return try XCTUnwrap(context.makeImage())
    }
    private func pixels(_ image: CGImage) throws -> [UInt8] {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        try bytes.withUnsafeMutableBytes { buffer in
            let context = try XCTUnwrap(CGContext(data: buffer.baseAddress, width: image.width, height: image.height,
                                                  bitsPerComponent: 8, bytesPerRow: image.width * 4,
                                                  space: CGColorSpaceCreateDeviceRGB(),
                                                  bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        }
        return bytes
    }
    func testRejectsInvalidAndNonIntegerBridgeValues() throws {
        XCTAssertEqual(try filters(), .original)
        for invalid: [String: Any] in [[:], ["contrast": true, "sharpness": 0, "warmth": 0],
                                      ["contrast": 100.2, "sharpness": 0, "warmth": 0],
                                      ["contrast": Double.nan, "sharpness": 0, "warmth": 0],
                                      ["contrast": 100, "sharpness": -1, "warmth": 0],
                                      ["contrast": 100, "sharpness": 0, "warmth": 101]] {
            XCTAssertThrowsError(try PageFilters.parse(invalid))
        }
    }
    func testOriginalReturnsExactImageAndWarmthPreservesDimensionsAndAlpha() throws {
        let source = try page()
        let original = try PageFilters.original.render(source, context: context)
        XCTAssertTrue(source === original)
        let warm = try filters(100, 0, 100).render(source, context: context)
        XCTAssertEqual(warm.width, source.width); XCTAssertEqual(warm.height, source.height)
        let bytes = try pixels(warm)
        let index = (40 * warm.width + 20) * 4
        XCTAssertGreaterThan(bytes[index], bytes[index + 2])
        XCTAssertEqual(bytes[index + 3], 255)
    }
    func testContrastAndSharpnessChangeEdgesWithoutChangingCanvas() throws {
        let source = try page()
        let base = try pixels(source)
        let contrast = try pixels(filters(150).render(source, context: context))
        let left = (40 * source.width + 20) * 4, right = (40 * source.width + 60) * 4
        XCTAssertGreaterThan(Int(contrast[right]) - Int(contrast[left]), Int(base[right]) - Int(base[left]))
        let sharp = try filters(100, 100).render(source, context: context)
        XCTAssertEqual(sharp.width, source.width); XCTAssertEqual(sharp.height, source.height)
        XCTAssertNotEqual(try pixels(sharp), base)
    }
    func testPDFCacheSeparatesOriginalCroppedAndFilteredAndNeverChangesSource() throws {
        let id = UUID().uuidString
        let file = try ComicStore.libraryRoot(prototype: false).appendingPathComponent(id + ".pdf")
        let store = ComicStore()
        defer { try? store.disposeBook(bookId: id, deleteCopy: true) }
        try UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 200, height: 300)).writePDF(to: file) { context in
            context.beginPage()
            UIColor.gray.setFill(); UIRectFill(CGRect(x: 30, y: 30, width: 140, height: 240))
        }
        let before = try Data(contentsOf: file)
        let original = try store.render(path: file.path, bookId: id, index: 0, maxPixel: 400)
        let changed = try store.render(path: file.path, bookId: id, index: 0, maxPixel: 400, filters: filters(120, 40, 60))
        let repeated = try store.render(path: file.path, bookId: id, index: 0, maxPixel: 400, filters: filters(120, 40, 60))
        let crop = try store.render(path: file.path, bookId: id, index: 0, maxPixel: 400, crop: true, filters: filters(120, 40, 60))
        let urls = try [original, changed, crop].map { try XCTUnwrap($0["url"] as? String) }
        XCTAssertEqual(Set(urls).count, 3)
        XCTAssertEqual(repeated["cached"] as? Bool, true)
        XCTAssertEqual(repeated["url"] as? String, urls[1])
        XCTAssertEqual(original["width"] as? Int, changed["width"] as? Int)
        XCTAssertLessThan(try XCTUnwrap(crop["width"] as? Int), try XCTUnwrap(original["width"] as? Int))
        XCTAssertNotEqual(try Data(contentsOf: XCTUnwrap(URL(string: urls[0]))), try Data(contentsOf: XCTUnwrap(URL(string: urls[1]))))
        XCTAssertEqual(try Data(contentsOf: file), before)
        try store.disposeBook(bookId: id, deleteCopy: true)
        for url in urls { XCTAssertFalse(FileManager.default.fileExists(atPath: try XCTUnwrap(URL(string: url)).path)) }
    }
    func testInplaceZIPFiltersDoNotUpscaleAndOriginalIsUntouched() throws {
        let id = UUID().uuidString
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".cbz")
        let store = ComicStore()
        defer { try? store.disposeBook(bookId: id, deleteCopy: false); try? FileManager.default.removeItem(at: file) }
        let png = try XCTUnwrap(UIImage(cgImage: page()).pngData())
        do {
            let archive = try Archive(url: file, accessMode: .create)
            try archive.addEntry(with: "1.png", type: .file, uncompressedSize: Int64(png.count),
                                 provider: { position, size in png.subdata(in: Int(position)..<Int(position) + size) })
        }
        let bytes = try Data(contentsOf: file)
        let path = try XCTUnwrap(ComicReferences.remember(file, bookId: id)["path"] as? String)
        let result = try store.render(path: path, bookId: id, index: 0, maxPixel: 8192, filters: filters(130, 50, 60))
        XCTAssertEqual(result["width"] as? Int, 80)
        XCTAssertEqual(result["height"] as? Int, 80)
        try store.disposeBook(bookId: id, deleteCopy: false)
        XCTAssertEqual(try Data(contentsOf: file), bytes)
    }
}
