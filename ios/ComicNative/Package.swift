// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ComicNative",
    platforms: [.iOS(.v15)],
    products: [.library(name: "ComicNative", targets: ["ComicNative"])],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.5.3"),
        .package(url: "https://github.com/weichsel/ZIPFoundation.git", exact: "0.9.20")
    ],
    targets: [
        .target(name: "ComicNative", dependencies: [
            .product(name: "Capacitor", package: "capacitor-swift-pm"),
            .product(name: "Cordova", package: "capacitor-swift-pm"),
            .product(name: "ZIPFoundation", package: "ZIPFoundation")
        ]),
        .testTarget(name: "ComicNativeTests", dependencies: ["ComicNative"])
    ]
)
