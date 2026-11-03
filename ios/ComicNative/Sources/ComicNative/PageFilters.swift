import CoreImage
import Foundation

/// 只处理预算内的解码图；整数百分比令 JS、缓存名与原生处理一致。
struct PageFilters: Equatable {
    let contrast: Int
    let sharpness: Int
    let warmth: Int
    static let original = PageFilters(contrast: 100, sharpness: 0, warmth: 0)
    private init(contrast: Int, sharpness: Int, warmth: Int) {
        self.contrast = contrast; self.sharpness = sharpness; self.warmth = warmth
    }
    static func parse(_ object: [String: Any]) throws -> PageFilters {
        func number(_ key: String, _ range: ClosedRange<Int>) throws -> Int {
            guard let value = object[key] as? NSNumber,
                  CFGetTypeID(value) != CFBooleanGetTypeID(),
                  value.doubleValue.isFinite,
                  value.doubleValue.rounded() == value.doubleValue,
                  value.doubleValue >= Double(range.lowerBound),
                  value.doubleValue <= Double(range.upperBound) else {
                throw ComicError.invalid("画面滤镜参数无效。")
            }
            return value.intValue
        }
        return try PageFilters(contrast: number("contrast", 50...150),
                               sharpness: number("sharpness", 0...100),
                               warmth: number("warmth", 0...100))
    }
    var isOriginal: Bool { self == .original }
    var cacheSuffix: String {
        isOriginal ? "" : "-filters-v1-c\(contrast)-s\(sharpness)-w\(warmth)"
    }
    func render(_ source: CGImage, context: CIContext) throws -> CGImage {
        guard !isOriginal else { return source }
        let extent = CGRect(x: 0, y: 0, width: source.width, height: source.height)
        var image = CIImage(cgImage: source)
        func apply(_ name: String, _ values: [String: Any]) throws {
            guard let filter = CIFilter(name: name) else {
                throw ComicError.invalid("无法应用画面滤镜，请还原画面后重试。")
            }
            filter.setValue(image, forKey: kCIInputImageKey)
            for (key, value) in values { filter.setValue(value, forKey: key) }
            guard let output = filter.outputImage else {
                throw ComicError.invalid("无法应用画面滤镜，请还原画面后重试。")
            }
            image = output
        }
        if contrast != 100 {
            try apply("CIColorControls", [kCIInputContrastKey: Double(contrast) / 100])
        }
        if sharpness > 0 {
            image = image.clampedToExtent()
            try apply("CISharpenLuminance", [kCIInputSharpnessKey: Double(sharpness) / 100])
            image = image.cropped(to: extent)
        }
        if warmth > 0 {
            let strength = Double(warmth) / 100
            try apply("CIColorMatrix", [
                "inputRVector": CIVector(x: 1 + 0.08 * strength, y: 0, z: 0, w: 0),
                "inputGVector": CIVector(x: 0, y: 1 + 0.02 * strength, z: 0, w: 0),
                "inputBVector": CIVector(x: 0, y: 0, z: 1 - 0.16 * strength, w: 0)
            ])
        }
        guard let result = context.createCGImage(image, from: extent) else {
            throw ComicError.invalid("无法应用画面滤镜，请还原画面后重试。")
        }
        return result
    }
}
