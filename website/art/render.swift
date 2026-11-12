import AppKit
import Foundation

let inputs = Array(CommandLine.arguments.dropFirst())
for path in inputs {
    let source = URL(fileURLWithPath: path)
    guard let image = NSImage(contentsOf: source),
          let pixels = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
          let data = NSBitmapImageRep(cgImage: pixels).representation(using: .png, properties: [:])
    else {
        throw CocoaError(.fileReadCorruptFile)
    }
    try data.write(to: source.deletingPathExtension().appendingPathExtension("png"))
}
