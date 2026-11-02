import CoreGraphics
import Foundation

/// 自动裁白边（PRD RD-10）：确定性算法，不用 AI。在缩小的灰度图上找出四周连续的白边或黑边，
/// 返回需要保留的区域；判断不了底色、页面几乎空白或裁得过多时不裁。
enum ContentBounds {
    struct Edges: Equatable {
        let left: Int, top: Int, right: Int, bottom: Int // right/bottom 不含
    }

    /// 分析图的长边；足以识别边框，又不占多少内存。
    static let analysisSide = 400

    /// 纯函数，便于 XCTest：gray 为逐行（自上而下）的 8 位灰度。
    static func edges(gray: [UInt8], width: Int, height: Int) -> Edges? {
        guard width >= 16, height >= 16, gray.count == width * height else { return nil }
        // 底色取最外两圈像素：多数接近白色视为白边，多数接近黑色视为黑边，其余不裁。
        var white = 0, black = 0, frame = 0
        for y in 0..<height {
            for x in 0..<width where x < 2 || y < 2 || x >= width - 2 || y >= height - 2 {
                let value = gray[y * width + x]
                frame += 1
                if value >= 200 { white += 1 } else if value <= 55 { black += 1 }
            }
        }
        let isBackground: (UInt8) -> Bool
        if Double(white) >= Double(frame) * 0.6 {
            isBackground = { $0 >= 190 }
        } else if Double(black) >= Double(frame) * 0.6 {
            isBackground = { $0 <= 60 }
        } else {
            return nil
        }
        // 允许 1% 的杂点（扫描灰尘、页码边角），避免一粒噪点挡住整条边。
        func rowBlank(_ y: Int, _ x0: Int, _ x1: Int) -> Bool {
            var count = 0
            let limit = max(1, (x1 - x0) / 100)
            for x in x0..<x1 where !isBackground(gray[y * width + x]) {
                count += 1
                if count > limit { return false }
            }
            return true
        }
        func columnBlank(_ x: Int, _ y0: Int, _ y1: Int) -> Bool {
            var count = 0
            let limit = max(1, (y1 - y0) / 100)
            for y in y0..<y1 where !isBackground(gray[y * width + x]) {
                count += 1
                if count > limit { return false }
            }
            return true
        }
        var top = 0
        while top < height && rowBlank(top, 0, width) { top += 1 }
        guard top < height else { return nil } // 整页空白
        var bottom = height
        while bottom > top && rowBlank(bottom - 1, 0, width) { bottom -= 1 }
        var left = 0
        while left < width && columnBlank(left, top, bottom) { left += 1 }
        var right = width
        while right > left && columnBlank(right - 1, top, bottom) { right -= 1 }
        guard right > left, bottom > top else { return nil }
        // 留 1% 余量，避免贴着线稿裁。
        let padX = max(1, width / 100), padY = max(1, height / 100)
        let result = Edges(left: max(0, left - padX), top: max(0, top - padY),
                           right: min(width, right + padX), bottom: min(height, bottom + padY))
        let keptWidth = result.right - result.left, keptHeight = result.bottom - result.top
        // 内容不到一半时多半是标题页或插图页，放大反而难看，不裁。
        guard keptWidth * 2 >= width, keptHeight * 2 >= height else { return nil }
        // 每边都不到 2% 时没有裁的必要。
        let minimumX = width / 50, minimumY = height / 50
        guard result.left > minimumX || result.top > minimumY ||
              width - result.right > minimumX || height - result.bottom > minimumY else { return nil }
        return result
    }

    /// 在缩小图上分析，返回原图像素坐标的保留区域；无需裁剪时为 nil。
    static func detect(_ image: CGImage) -> CGRect? {
        let scale = min(1, Double(analysisSide) / Double(max(image.width, image.height)))
        let width = max(1, Int((Double(image.width) * scale).rounded()))
        let height = max(1, Int((Double(image.height) * scale).rounded()))
        var gray = [UInt8](repeating: 255, count: width * height)
        let drawn: Bool = gray.withUnsafeMutableBytes { buffer in
            guard let context = CGContext(data: buffer.baseAddress, width: width, height: height,
                                          bitsPerComponent: 8, bytesPerRow: width,
                                          space: CGColorSpaceCreateDeviceGray(),
                                          bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
            // 透明区域按白底处理。
            context.setFillColor(gray: 1, alpha: 1)
            context.fill(CGRect(x: 0, y: 0, width: width, height: height))
            context.interpolationQuality = .medium
            context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
            return true
        }
        guard drawn, let edges = edges(gray: gray, width: width, height: height) else { return nil }
        let sx = Double(image.width) / Double(width), sy = Double(image.height) / Double(height)
        let rect = CGRect(x: (Double(edges.left) * sx).rounded(.down),
                          y: (Double(edges.top) * sy).rounded(.down),
                          width: (Double(edges.right - edges.left) * sx).rounded(.up),
                          height: (Double(edges.bottom - edges.top) * sy).rounded(.up))
        return rect.intersection(CGRect(x: 0, y: 0, width: image.width, height: image.height)).integral
    }

    /// 返回裁好的图和保留比例（宽、高）；不裁时原样返回、比例为 1。
    static func crop(_ image: CGImage) -> (image: CGImage, widthRatio: Double, heightRatio: Double) {
        guard let rect = detect(image), !rect.isEmpty, let cropped = image.cropping(to: rect) else {
            return (image, 1, 1)
        }
        return (cropped, Double(cropped.width) / Double(image.width), Double(cropped.height) / Double(image.height))
    }
}
