import CoreGraphics
import Foundation
import XCTest
@testable import ComicNative

final class ContentBoundsTests: XCTestCase {
    /// 生成 width×height 的灰度页：底色 background，内容区 [x0,x1)×[y0,y1) 填 ink。
    private func page(_ width: Int, _ height: Int, background: UInt8, ink: UInt8,
                      content: (Int, Int, Int, Int)) -> [UInt8] {
        var gray = [UInt8](repeating: background, count: width * height)
        for y in content.1..<content.3 {
            for x in content.0..<content.2 { gray[y * width + x] = ink }
        }
        return gray
    }

    func testTrimsWhiteMarginsWithSmallPadding() {
        let gray = page(200, 300, background: 255, ink: 30, content: (40, 30, 160, 270))
        let edges = ContentBounds.edges(gray: gray, width: 200, height: 300)
        XCTAssertEqual(edges, .init(left: 38, top: 27, right: 162, bottom: 273))
    }

    func testTrimsBlackScannerBorders() {
        let gray = page(200, 200, background: 10, ink: 240, content: (20, 20, 180, 180))
        XCTAssertEqual(ContentBounds.edges(gray: gray, width: 200, height: 200),
                       .init(left: 18, top: 18, right: 182, bottom: 182))
    }

    func testIgnoresIsolatedSpecks() {
        var gray = page(200, 300, background: 255, ink: 30, content: (40, 30, 160, 270))
        gray[5 * 200 + 100] = 0 // 上边距里的一粒灰尘
        XCTAssertEqual(ContentBounds.edges(gray: gray, width: 200, height: 300)?.top, 27)
    }

    func testLeavesPagesAloneWhenCroppingIsUnsafeOrPointless() {
        // 全彩满版：底色既不白也不黑。
        XCTAssertNil(ContentBounds.edges(gray: page(100, 100, background: 128, ink: 30, content: (0, 0, 10, 10)),
                                         width: 100, height: 100))
        // 空白页。
        XCTAssertNil(ContentBounds.edges(gray: [UInt8](repeating: 255, count: 100 * 100), width: 100, height: 100))
        // 只有一小块内容（标题页），裁了会放大过多。
        XCTAssertNil(ContentBounds.edges(gray: page(200, 200, background: 255, ink: 0, content: (80, 80, 120, 120)),
                                         width: 200, height: 200))
        // 边距不到 2%。
        XCTAssertNil(ContentBounds.edges(gray: page(200, 200, background: 255, ink: 0, content: (2, 2, 198, 198)),
                                         width: 200, height: 200))
    }

    func testCropsARealImageAndReportsKeptRatio() throws {
        let width = 800, height = 1200
        let context = try XCTUnwrap(CGContext(data: nil, width: width, height: height, bitsPerComponent: 8,
                                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                                              bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue))
        context.setFillColor(red: 1, green: 1, blue: 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.setFillColor(red: 0.1, green: 0.2, blue: 0.6, alpha: 1)
        // CG 坐标原点在左下：这块内容在图上方 100、下方 300 像素处留白。
        context.fill(CGRect(x: 100, y: 300, width: 600, height: 800))
        let image = try XCTUnwrap(context.makeImage())
        let result = ContentBounds.crop(image)
        XCTAssertLessThan(result.image.width, width)
        XCTAssertEqual(Double(result.image.width), 600 + 2 * 8, accuracy: 12)
        XCTAssertEqual(Double(result.image.height), 800 + 2 * 12, accuracy: 16)
        XCTAssertEqual(result.widthRatio, Double(result.image.width) / Double(width), accuracy: 0.0001)
    }
}
