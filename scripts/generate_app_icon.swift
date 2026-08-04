import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let images = root.appendingPathComponent("assets/images")

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  NSColor(
    calibratedRed: CGFloat((hex >> 16) & 0xff) / 255,
    green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255,
    alpha: alpha
  )
}

func canvas(size: Int, alpha: Bool, draw: () -> Void) -> NSBitmapImageRep {
  let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: alpha ? 4 : 3,
    hasAlpha: alpha,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  )!
  bitmap.size = NSSize(width: size, height: size)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
  NSGraphicsContext.current?.imageInterpolation = .high
  draw()
  NSGraphicsContext.restoreGraphicsState()
  return bitmap
}

func bookPaths(scale: CGFloat, offset: CGPoint) -> (NSBezierPath, NSBezierPath, NSBezierPath) {
  func p(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
    NSPoint(x: offset.x + x * scale, y: offset.y + y * scale)
  }

  let left = NSBezierPath()
  left.move(to: p(512, 728))
  left.curve(to: p(235, 705), controlPoint1: p(445, 770), controlPoint2: p(325, 760))
  left.line(to: p(210, 340))
  left.curve(to: p(500, 312), controlPoint1: p(315, 395), controlPoint2: p(410, 372))
  left.curve(to: p(512, 728), controlPoint1: p(507, 430), controlPoint2: p(510, 605))
  left.close()

  let right = NSBezierPath()
  right.move(to: p(512, 728))
  right.curve(to: p(789, 705), controlPoint1: p(579, 770), controlPoint2: p(699, 760))
  right.line(to: p(814, 340))
  right.curve(to: p(524, 312), controlPoint1: p(709, 395), controlPoint2: p(614, 372))
  right.curve(to: p(512, 728), controlPoint1: p(517, 430), controlPoint2: p(514, 605))
  right.close()

  let spineRect = NSRect(x: offset.x + 506 * scale, y: offset.y + 312 * scale, width: 12 * scale, height: 420 * scale)
  let spine = NSBezierPath(roundedRect: spineRect, xRadius: 6 * scale, yRadius: 6 * scale)
  return (left, right, spine)
}

func drawBook(scale: CGFloat = 1, offset: CGPoint = .zero, monochrome: Bool = false, shadow: Bool = true) {
  let (left, right, spine) = bookPaths(scale: scale, offset: offset)

  if shadow {
    NSGraphicsContext.saveGraphicsState()
    let dropShadow = NSShadow()
    dropShadow.shadowColor = color(0x061A15, alpha: 0.32)
    dropShadow.shadowBlurRadius = 24 * scale
    dropShadow.shadowOffset = NSSize(width: 0, height: -12 * scale)
    dropShadow.set()
    color(0x000000, alpha: 0.01).setFill()
    left.fill()
    right.fill()
    NSGraphicsContext.restoreGraphicsState()
  }

  if monochrome {
    NSColor.black.setFill()
    left.fill()
    right.fill()
    spine.fill()
    return
  }

  color(0xF4F0E7).setFill()
  left.fill()
  color(0xFEFCF7).setFill()
  right.fill()
  color(0xA47D42).setFill()
  spine.fill()

  color(0x1A5549, alpha: 0.10).setStroke()
  left.lineWidth = 2 * scale
  right.lineWidth = 2 * scale
  left.stroke()
  right.stroke()
}

func save(_ bitmap: NSBitmapImageRep, name: String) throws {
  let data = bitmap.representation(using: .png, properties: [.compressionFactor: 1])!
  try data.write(to: images.appendingPathComponent(name), options: .atomic)
}

func flattenPNG(_ name: String) throws {
  let source = images.appendingPathComponent(name)
  let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("iyf-\(name)")
  let process = Process()
  let output = Pipe()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
  process.arguments = [
    "ffmpeg", "-y", "-i", source.path, "-vf", "format=rgb24", temporary.path,
  ]
  process.standardOutput = output
  process.standardError = output
  try process.run()
  process.waitUntilExit()
  guard process.terminationStatus == 0 else {
    throw NSError(
      domain: "IYFIconGenerator",
      code: Int(process.terminationStatus),
      userInfo: [NSLocalizedDescriptionKey: "ffmpeg could not flatten \(name)"]
    )
  }
  _ = try FileManager.default.replaceItemAt(source, withItemAt: temporary)
}

try save(canvas(size: 1024, alpha: true) {
  let rect = NSRect(x: 0, y: 0, width: 1024, height: 1024)
  let background = NSGradient(colors: [color(0x17483D), color(0x0D3029)])!
  background.draw(in: rect, angle: -90)
  drawBook()
}, name: "icon.png")

try save(canvas(size: 1024, alpha: true) {
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
  drawBook(scale: 0.82, offset: CGPoint(x: 92, y: 92), shadow: false)
}, name: "android-icon-foreground.png")

try save(canvas(size: 1024, alpha: true) {
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: 1024, height: 1024).fill()
  drawBook(scale: 0.82, offset: CGPoint(x: 92, y: 92), monochrome: true, shadow: false)
}, name: "android-icon-monochrome.png")

try save(canvas(size: 512, alpha: true) {
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: 512, height: 512).fill()
  drawBook(scale: 0.5, shadow: false)
}, name: "splash-icon.png")

try save(canvas(size: 64, alpha: true) {
  let rect = NSRect(x: 0, y: 0, width: 64, height: 64)
  let background = NSGradient(colors: [color(0x17483D), color(0x0D3029)])!
  background.draw(in: rect, angle: -90)
  drawBook(scale: 0.0625, shadow: false)
}, name: "favicon.png")

try flattenPNG("icon.png")
try flattenPNG("favicon.png")

print("Generated IYF Quran icon, Android foreground/monochrome, splash mark, and favicon.")
