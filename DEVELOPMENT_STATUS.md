# 开发进度检查点

## 最新检查点：M3-03 自动裁白边（第一项 Pro 功能，2026-11-02）

- 原生（`ContentBounds.swift`）：在长边 400 的灰度缩略图上取最外两圈像素判断白底/黑底（60% 以上），逐行逐列向内找连续空白（容许 1% 杂点），留 1% 余量；底色不明、整页空白、保留区不足一半（标题页/插图页）或每边都不到 2% 时不裁。确定性算法，无新依赖。`renderPage` 接受 `crop: true`（不再拒绝），图片页与 PDF 页都支持；裁边结果单独缓存（`-crop.png`），`sourceWidth/Height` 按保留比例换算。新增 `ContentBoundsTests`（5 个），XCTest 现共 19 个，未运行。
- 阅读器：阅读设置新增「自动裁白边 Pro」开关，按书保存到已有的 `books.cropBorders`（不改表）；只在 Pro 已解锁时向原生请求裁边，失去 Pro 后保留选择但按原图显示，关闭永远可用。未解锁时开启会关闭设置并打开购买页，显示当前页「原图 / 裁白边后」对比；在购买页解锁后关闭即为这本书开启。开关在正式商店开放购买前隐藏（与设置入口规则一致）。
- `proPolicy` 将 crop 标为已交付（1/2，仍未开放购买）。
- 自动检查（实际执行）：`pnpm test` 25 文件 / 195 用例通过（新增 2：裁边请求参数、按书保存）；`pnpm lint`、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过；临时预览页检查 375 宽购买页对比布局，无控制台错误（已删除）。
- 未测：Swift 编译与 XCTest、真实扫描页的裁边效果与耗时、条漫/双页下的观感、真机。
- 下一步：M3-04 应用锁与隐藏系列（第二项 Pro 功能，完成后开放购买）。

## 上一检查点：Pro 规划确认与内购接入、购买页（M3-01/02，2026-11-02）

- 决定（用户确认，已写入 PRD 第 8 节）：Pro 国区 ¥20 一次买断；自定义分组永久免费；1.0 Pro = 自动裁白边 + 应用锁与隐藏系列，1.1 原位阅读 + 批量整理，1.2 自动翻页 + 画面滤镜；两项交付后才开放购买。详见 [docs/PRO.md](./docs/PRO.md)。
- iOS：新增 `ProStorePlugin`（StoreKit 2，系统框架，无新依赖）并在 `ComicBridgeViewController` 注册；`check:ios` 增加注册、接口与商品标识检查。新增 `ios/App/LumiComicPro.storekit` 供 Xcode 离线测试（需在 Scheme 中手动选择，未登记进工程）。
- 网页层：`src/app/proPolicy.ts`（功能清单、开放门槛、入口可见性、只拦新增操作）、`src/app/pro.ts`（状态与购买/恢复）、`ProDialog` 购买页、设置页「微光 Pro」入口（正式商店开放前隐藏，Debug/TestFlight 可见并可测试购买）、中英文案。
- 自动检查（实际执行）：`pnpm test` 24 文件 / 193 用例通过（新增 10）；`pnpm lint`、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过；临时预览页在 375/1280 宽截图检查购买页布局，无控制台错误（预览文件已删除）。
- 未测：Swift 编译、StoreKit 沙盒/本地配置购买与恢复、退款与家人共享、真机。App Store Connect 的内购项目与付费协议需用户创建。
- 下一步：M3-03 自动裁白边（第一项 Pro 功能）。

## 上一检查点：应用图标与显示名称（2026-11-02）

- 图标：用户确认采用自己提供的「翻页漫画」图标（米白底、蓝色分格页、右下角橙黄翻页），源图存档于 `design/app-icon/source-1254.png`。iOS `AppIcon-512@2x.png` 为 1024×1024 不透明 RGB；安卓 5 档密度重新生成 `ic_launcher`（圆角）、`ic_launcher_round`（圆形）与自适应前景 `ic_launcher_foreground`（108dp，内容约 56dp），自适应背景色改为图标底色 `#FEFBF0`。
- 显示名称（用户确认）：简体中文「微光漫画」、繁体中文「微光漫畫」、英文「LumiComic」。iOS 新增 `en`/`zh-Hans`/`zh-Hant.lproj/InfoPlist.strings`，并在 `project.pbxproj` 登记 InfoPlist.strings 变体组与 knownRegions；Info.plist 默认值仍为「微光漫画」。安卓默认 `values` 改为 LumiComic，新增 `values-zh` 为「微光漫画」。
- App Store 名称/副标题建议（未在 App Store Connect 设置）：「微光漫画 - 本地漫画阅读器」/「只读你自己的漫画，无广告不联网」；英文「LumiComic - Local Comic Reader」/「Your own comics. Offline, no ads.」。
- 自动检查（实际执行）：`pnpm build:ios`、`pnpm check:ios --release`、`pnpm lint`、`pnpm test`（183）通过。
- 未测：Xcode 编译（pbxproj 为手工编辑）、主屏图标与中英文名称真机显示、安卓启动器显示；启动画面仍为 Capacitor 默认，未改。

## 上一检查点：EPUB 导入验收与 TestFlight 构建 5 上传（2026-11-01）

- 范围：在 macOS（Xcode 26.6, macOS 26.6.2）从 m0 最新提交 `1f26206`（M1-15: EPUB 图片漫画导入与阅读）完成全部检查、ComicNative 全部 XCTest、模拟器 EPUB 功能验收，再以构建号 5 归档上传 TestFlight。
- 自动检查（实际执行）：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test` 22 文件 / 183 用例、`pnpm build:ios`、`pnpm check:ios --release` 全部通过；`xcodebuild -resolvePackageDependencies` 正常。
- XCTest：ComicNative 包 iPhone 17 模拟器 `xcodebuild -scheme ComicNative test` **14/14 通过**（含新增 2 个 EpubTests）。
- 模拟器验收（Debug 构建实际执行）：导入 `fixed-layout-12p.epub` 入库出封面，打开 12 页页序正确、翻页正常；该样本 spine 带 `page-progression-direction="rtl"`，书自动以 Right to left 打开；自造 reflowable 纯文字 EPUB 被拒绝（提示「This EPUB is mostly text. Only image-based comic EPUBs are supported.」），不入库；ZIP/PDF 回归正常；无崩溃。
- 归档与上传：`CURRENT_PROJECT_VERSION` 4→5，营销版本 0.0.1。`xcodebuild archive`（Team `7R5Z28YJZ9`）成功；`-exportArchive`（app-store-connect/upload，API Key `N23VM7F87M`）成功。
- Apple 处理结果：build `5` 状态 VALID（build id `9defbbca-7a29-4b7b-84d3-4d60a35868f8`，上传时间 2026-11-01T05:58:13-08:00）。未分配测试组，真机验收由用户完成。
- 未执行：性能回归（大书/大 EPUB/大 PDF 内存与翻页耗时）、安卓验证。
- 构建制品（未入库）：`release/LumiComic.xcarchive`（含 dSYM）、`release/upload/`、`release/ios-derived/`。

## 上一检查点：EPUB（图片漫画）导入与阅读（2026-11-01）

- 范围：在 Linux 云端容器从 m0 `d36bacf`（M1-14）继续，正式导入支持 EPUB。只支持以图片为页面的漫画 EPUB；文字为主的书、加密或受版权保护（DRM）的 EPUB 拒绝导入。没有 Mac，Swift 未编译、XCTest 未运行、真机未验收。
- iOS 原生：文件选择器增加 `.epub`；副本存为 `ComicLibrary/<UUID>.epub`，`source`/`disposeBook`/`removeCopy` 一并支持。EPUB 本质是 ZIP，图片页沿用现有 ZIP 读取、降采样与缓存，无新依赖、安装包无增量。`inspect` 返回 `format: "epub"`、ZIP 条目，并附 `texts`：扩展名为 xml/opf/xhtml/html/htm/svg 的文本（单个 ≤1 MiB、合计 ≤16 MiB，校验 CRC）；图片不跨桥。新增 `EpubTests`（2 个），XCTest 现共 14 个，未运行。
- 网页层纯逻辑 `src/archive/epub.ts`：解析 `META-INF/container.xml` → OPF manifest/spine → 页面文档中的 `<img src>` 与 SVG `<image xlink:href>`，按 spine 顺序生成页目录（去重、拒绝外链与越界路径）；`page-progression-direction="rtl"` 写入每书方向；`encryption.xml` 中非字体资源加密或存在 `META-INF/rights.xml`/`sinf.xml` 视为受保护；过半 spine 文档为纯文字时判定为文字书。解析不到 OPF 时退回按文件名自然排序的全部图片。
- `ImportQueue` 接受 .epub，书籍 `format` 记为 `epub`（模型已有该值，不改表/v1/v2）；新增中英文提示；书名解析去掉 `.epub`；书架导入说明改为 ZIP、CBZ、PDF 或 EPUB。
- 自动检查（实际执行）：`pnpm test` 22 文件 / 183 用例通过（新增 8：EPUB 解析 6、导入 2）；`pnpm lint`、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过。
- 未测：Swift 编译、14 个 XCTest、模拟器/真机导入与阅读真实 EPUB（固定版式日漫、Kindle Comic Creator 导出等）、大 EPUB 性能、安卓。
- 已知边界：只认 `<img>`/`<image>` 引用，CSS 背景图页面不识别（会退回全部图片）；EPUB 中的 SVG 图片本身不支持渲染；文字书不支持。

## 上一检查点：ComicInfo 右翻识别修复与 TestFlight 构建 4 上传（2026-11-01）

- 范围：修复上一轮验收发现的 ComicInfo `<Manga>` 标记未识别问题，复验后以构建号 4 上传 TestFlight。
- 代码修复：`ComicStore.inspect` 读根目录 `ComicInfo.xml` 的 `<Manga>` 标记，`YesAndRightToLeft`/`Yes` 在返回里带 `manga: "rtl"`（文件缺失或解析失败不阻断导入，不返回该字段）；`Inspection` 增加可选 `manga`，`ImportQueue` 据此把新书 `direction` 置为 `rtl`（仍是每书偏好，用户可在阅读设置覆盖）。未标记的书仍为全局默认。
- 自动检查（实际执行）：新增 2 个 XCTest（`ComicInfoTests`，右翻识别与缺失/No 不误判）——XCTest 现共 12 个，iPhone 17 模拟器 12/12 通过；新增 1 个 Vitest（ImportQueue 方向写入）——全量 175 通过；`pnpm lint`、`pnpm build:ios`、`pnpm check:ios --release` 通过。
- 模拟器复验（Debug 构建实际执行）：重新导入含 `<Manga>YesAndRightToLeft</Manga>` 的 CBZ，阅读器自动 RTL（首次引导点按区已翻转，左缘=下一页，菜单显示 Right to left）；普通 ZIP 仍为 LTR；PDF 正常；无崩溃。
- 归档与上传：`CURRENT_PROJECT_VERSION` 3→4，营销版本 0.0.1。`xcodebuild archive`（Team `7R5Z28YJZ9`）成功；`-exportArchive`（app-store-connect/upload，API Key `N23VM7F87M`）成功。
- Apple 处理结果：build `4` 状态 VALID（build id `69633c88-3c45-45db-b232-fb3d26cfe7c1`，上传时间 2026-11-01T05:15:33-08:00）。未分配测试组，真机验收由用户完成。
- 未执行：性能回归（大书/大 PDF 内存与翻页耗时）、ComicInfo 其他字段（标题/作者等元数据）、安卓验证。
- 构建制品（未入库）：`release/LumiComic.xcarchive`（含 dSYM）、`release/upload/`、`release/ios-derived/`。

## 上一检查点：模拟器功能验收与 TestFlight 构建 3 上传（2026-11-01）

- 范围：在 macOS（Xcode 26.6, macOS 26.6.2）先对 m0 最新代码（含 PDF 导入）做 iPhone 17 模拟器功能验收，再以构建号 3 归档上传 TestFlight。
- 模拟器验收（Debug 构建实际执行）：空书架正常；文件选择器导入 ZIP、CBZ、PDF 各一均入库出封面；ZIP 书页图渲染、LTR 点按翻页、页数正确（23 页含跨页）、目录缩略图与跳转可用；CBZ 37 页打开正常；PDF 以 PDFKit 白底位图渲染、5 页翻页到底；阅读器菜单/设置/进度条可用；全屏进出状态栏正确；杀进程重启后书籍、导入记录、进度与「继续阅读」均保留；横竖屏旋转无崩溃（无 .ips 记录）；无网络请求。
- 验收发现（中，已修复）：CBZ 的 ComicInfo `<Manga>YesAndRightToLeft</Manga>` 未被识别，书仍以 LTR 打开；手动在阅读设置切换 RTL 后点按方向正确。代码中没有 ComicInfo 解析，`direction` 只是每书偏好——已在下一轮检查点修复。
- 构建与上传：`CURRENT_PROJECT_VERSION` 2→3，营销版本 0.0.1。`xcodebuild archive`（Team `7R5Z28YJZ9`）成功；`-exportArchive`（app-store-connect/upload，API Key `N23VM7F87M`）成功。
- Apple 处理结果：build `3` 状态 VALID（build id `dd913370-02af-4e96-a31a-3124e1bad908`，上传时间 2026-11-01T04:55:11-08:00）。未分配测试组，真机验收由用户完成。
- 未执行：性能回归（大书/大 PDF 内存与翻页耗时）、ComicInfo 元数据识别（上述发现）、安卓验证。
- 构建制品（未入库）：`release/LumiComic.xcarchive`（含 dSYM）、`release/upload/`、`release/ios-derived/`（Debug 模拟器构建）。

## 上一检查点：TestFlight 第二个内部测试构建上传（2026-11-01）

- 范围：在 macOS（Xcode 26.6, macOS 26.6.2）从 m0 最新提交 `a0fe039`（M1-11: PDF 导入与阅读）完成依赖安装、正式 Web 构建与 iOS 同步、ComicNative 全部 XCTest、真机 Release 归档、App Store 发行签名与 TestFlight 上传。不含 App Store 送审与新增外部测试。
- 实际执行：`pnpm install --frozen-lockfile`（pnpm 11.21.0、Node 24.21.0）、`pnpm build:ios`、`pnpm check:ios --release` 全部通过；`xcodebuild -resolvePackageDependencies` 正常。
- XCTest：ComicNative 包在 iPhone 17 模拟器上 `xcodebuild -scheme ComicNative test` 执行 **10/10 通过**（含新增 2 个 PDFPageTests）。运行前做了一处必要修复（已随 M1-12 提交入库）：`ios/ComicNative/Package.swift` 目标补 `.product(name: "Cordova", package: "capacitor-swift-pm")`——App 构建时 Cordova 经 CapApp-SPM 传递可得，独立跑包测试缺少它会报 `module 'Cordova' not found`。
- 提交审核检查：`pnpm lint` 与全量 `pnpm test` 通过，21 文件 / 174 用例。
- 归档与上传：`CURRENT_PROJECT_VERSION` 由 1 改为 2（build 1 已存在于 ASC），营销版本仍为 0.0.1。`xcodebuild archive`（Team `7R5Z28YJZ9`）成功；`xcodebuild -exportArchive`（app-store-connect/upload，API Key `N23VM7F87M`）成功。
- Apple 处理结果：build `2` processingState=VALID（build id `05f48cf0-1a16-4c69-8ac7-301377577c67`），上传时间 2026-11-01T04:27:47-08:00。未分配测试组，由用户在 TestFlight 分配；真机验收由用户完成。
- 未执行：性能/浏览器回归、模拟器与真机功能验收、安卓验证。
- 构建制品（未入库）：`release/LumiComic.xcarchive`（含 dSYM）、`release/upload/` 上传产物、`release/ios-derived/`。

## 历史检查点：PDF 导入与阅读（2026-11-01）

- 范围：在 Linux 云端容器从 `devin/ios-testflight-20261031`（50cfd83）继续，正式导入支持 PDF。没有 Mac，Swift 未编译、XCTest 未运行、真机未验收。
- iOS 原生（`ios/ComicNative`）：
  - 文件选择器增加 `.pdf`；PDF 副本存为 `ComicLibrary/<UUID>.pdf`，ZIP/CBZ 仍为 `.zip`。`source` 只接受 zip/pdf 扩展名，其余定位规则不变；`disposeBook`、`removeCopy` 一并清理 `.pdf`。
  - 使用系统 PDFKit（无新依赖，安装包增量可忽略，未实测）。`inspect` 返回 `format: "pdf"`，每页一条 entry（name 为 0001 起的四位序号）；需要密码的 PDF 记为 encrypted，不尝试解锁。
  - `renderPage`/`thumbnail` 对 PDF 按 cropBox 与页面旋转绘制白底位图：长边不超过请求尺寸、总像素不超过四百万，矢量页可放大到请求尺寸；缓存、元数据与清理沿用图片页逻辑。
  - 新增 `PDFPageTests`（2 个），XCTest 现共 10 个，均未运行。
- 网页层：`pdfPageList` 按原生页序生成页目录；`ImportQueue` 接受 .pdf，书籍 `format` 记为 `pdf`（模型已有该值，不改表/v1/v2）；加密与空 PDF 有独立提示并补英文；书名解析去掉 `.pdf`；书架导入说明改为 ZIP、CBZ 或 PDF。
- 自动检查（实际执行）：`pnpm test` 21 文件 / 174 用例通过（新增 3）；`pnpm lint`、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过。
- 未测：Swift 编译、10 个 XCTest、真机导入/阅读 PDF、大页数 PDF 性能与内存、安卓（插件仍未实现）。

## 历史检查点：TestFlight 首个内部测试构建上传（2026-10-31）

- 范围：在 macOS（Xcode 26.6, macOS 26.6.2）从基线提交 `d8400b1`（分支 `devin/ios-testflight-20261031`）完成依赖安装、正式 Web 构建与 iOS 同步、Swift 首次真实编译、真机 Release 归档、App Store 发行签名与 TestFlight 上传。不含 App Store 送审与新增外部测试。
- 实际执行：`pnpm install --frozen-lockfile`（pnpm 11.21.0、Node 24.21.0）、`pnpm build:ios`、`pnpm check:ios --release` 全部通过；`xcodebuild -resolvePackageDependencies` 解析 CapacitorApp/ZIPFoundation 0.9.20/capacitor-swift-pm 8.5.3/CapApp-SPM/ComicNative；Release 模拟器构建成功；`xcodebuild archive`（Team `7R5Z28YJZ9`）成功；`xcodebuild -exportArchive`（app-store-connect 上传）成功。
- 凭据与记录：ASC API Key `N23VM7F87M`；Team `7R5Z28YJZ9`；新建并注册 Bundle ID `dev.weiguang.comic`（名称 LumiComic）；用户在 App Store Connect 新建 App「微光漫画」（app id 6829142764），上传前该 App 无历史构建，构建号取 1、营销版本 0.0.1，与工程一致。
- Apple 处理结果：build `1` processingState=VALID（build id `20221f4a-a705-486d-b20b-3ad6d42c8feb`），上传时间 2026-10-30T23:03:08-07:00。未分配测试组，内部测试由用户在 TestFlight 分配；真机验收由用户完成。
- 未执行：8 个 XCTest、lint/全量 Vitest 复跑、性能/浏览器回归、模拟器与真机功能验收。本次仅做构建上传所必需的检查。
- 构建制品（未入库）：`release/LumiComic.xcarchive`（含 dSYM）、`release/export/App.ipa`、`release/upload/` 上传产物、`release/ios-derived/` 模拟器构建目录。

## 上一检查点：iOS 代码验收与缺陷修复（2026-10-30）

- 范围：在 Windows 上对照 Capacitor 8.5.3（`node_modules/@capacitor/ios` 源码）与 ZIPFoundation 0.9.20 源码逐项核对 Swift 接口与 iOS 平台行为，并审查网页层导入、书架与阅读器。没有 Mac，Swift 未编译、XCTest 未运行。
- 代码修复：
  - **编译阻断**：Capacitor 8 的 `SystemBars.swift` 在 `CAPBridgeViewController` 扩展中以 `override public`（非 open）重写 `prefersHomeIndicatorAutoHidden`，App 模块的 `ComicBridgeViewController` 再重写会报 “Overriding non-open property outside of its defining module”。改为重写 UIKit 的 `childForHomeIndicatorAutoHidden`：全屏时指向只返回 true 的子控制器，平时交回 Capacitor 默认逻辑；状态栏仍用可重写的 `prefersStatusBarHidden`。`check:ios` 改为禁止该重写并要求 child 接管（兼容 CRLF 检出）。
  - **应用更新后书架失效**：书籍记录保存的是导入时的沙盒绝对路径，iOS 更新或从备份恢复后容器 UUID 会变，旧实现的根目录比对会拒绝所有副本。`ComicStore.source` 改为只取库目录名（ComicLibrary/ComicPrototype）与 UUID 文件名，在当前容器根目录重新定位，仍拒绝其他目录与符号链接。不改数据库、v1/v2 或网页接口。新增 2 个 XCTest，现共 8 个。
  - **网页进程被回收后状态栏残留隐藏**：WebContent 进程终止时 Capacitor 只重载网页，原生全屏标记保留。打开书架前先调用 `setFullscreen(false)` 恢复。
  - **状态栏文字看不清**：应用外观或阅读背景与系统深浅色不一致时状态栏仍跟随系统。书架按应用主题、阅读器按阅读背景调用 Capacitor 内置 SystemBars 设置文字颜色；无新依赖。
  - **英文界面显示中文错误**：原生错误原文写入导入记录后由 `t()` 显示，但没有英文翻译。新增 `src/i18n/native.en.ts`，并加 Vitest 扫描正式插件 Swift 源码，防止新增文案漏翻。顺带去掉正式渲染错误里的“原型”字样。
  - 封面与页面图片加 `-webkit-touch-callout: none`，避免长按弹出系统“存储/拷贝”菜单。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过；全量 `pnpm test` 21 个文件 / 171 个 Vitest 通过；改动文件 Prettier、ESLint 通过（未跑全量 lint）。用旧版控制器验证 `check:ios` 能正确拦截。
- 已审未改的风险（需真机数据再定）：页面缓存用 PNG 编码，4 MP 页面编码耗时和缓存体积可能影响翻页 ≤100ms 与 500 MiB 缓存命中；`trimCache` 每次新渲染都会遍历缓存目录；书架数据完全在 WebView IndexedDB，系统存储紧张时的清理行为未验证；文件复制没有后台任务保护，切到后台会被挂起；ZIP 内 Deflate64/LZMA 条目会导入成功但该页无法显示。
- 真机验收：本轮全部未做。Swift 编译、8 个 XCTest、全屏状态栏/Home 指示条、应用更新后打开旧书、状态栏颜色、长按菜单均需在 Mac/iPhone 上确认。

## 最新检查点：M1 阅读器收尾，全屏、记住位置与提交前全量检查（2026-10-30）

- 用户授权收尾后做阶段提交；分支 `m0`，本轮开始时仓库没有任何提交、作者未配置。不伪造身份，检查完成后再取得作者姓名与邮箱。首次阶段提交会包含已有 M0/M1 工程、独立原型和本轮实现，提交状态以 Git 记录为准。
- 代码实现：
  - 工具栏增加全屏按钮。浏览器调用 Fullscreen API 并订阅 fullscreenchange；请求失败保持真实状态、显示中英文提示，可重试。显示会话由外层 Reader 持有，下一卷不退出全屏，返回书架先等待显示恢复；等待中的进入请求完成后再恢复，未开始的请求失效。
  - 新增轻量原生 `ComicReader.getDisplayState / setFullscreen({ enabled })`。iOS 承载 WebView 的控制器隐藏状态栏、请求自动隐藏 Home 指示条，退出恢复原显示标记；原生显示操作跨会话串行。没有新增依赖或原生库；没有 APK/IPA，安装包增量尚未实测。
  - 阅读设置增加“记住阅读位置”，复用 reader.defaults 的可选 remember 字段，旧库默认开启，不改表、索引或 v1/v2。按原型，关闭后保留历史 progress、offset 和 lastReadAt，重开仍可恢复旧页；停止当前会话后续写入及失败重试，书签与主动标记不受影响。重新开启后，只在设置关闭且当前图片实际显示时继续保存。
  - 进度事务同时读取 settings，防止其他旧写入器越过关闭策略；暂停会使尚未开始的排队写入失效，已提交的记录保留。增加英文文案、语义色开关和状态提示；开关 52×44px，顶部按钮 44×44px，功能文字至少 11px。正式模块不引用 Demo/原型存储，原型继续独立。
  - 提交审核修正 lint 扫描范围，排除已忽略的 release、prototype-dist 和 Gradle 缓存；仅格式化一处旧升级测试，不跳过源代码检查。
- 自动检查：`pnpm lint`、`pnpm test` 全量通过，20 个文件 / 170 个 Vitest；本轮新增全屏会话 7、记住位置与事务 8。`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过，包含 TS strict、Web 构建、iOS 同步和原型/离线隔离静态检查，不含 Swift 编译。
- 浏览器检查：
  - 真实隔离 IndexedDB＋原生替身：先保存第 4 页，关闭后翻至第 7 页及卷末，progress 与 lastReadAt 均未变；仍可在第 7 页写书签。下一卷保持全屏且未读卷没有产生进度，返回书架恢复原显示。刷新后仍关闭且恢复第 4 页；重新开启并关设置后保存第 7 页。
  - 全屏替身核对进入、跨卷、退出恢复、失败提示及重试；另用实际浏览器 Fullscreen API 点检进入/退出按钮状态及全屏中返回书架，控制台无错误。系统 Escape 和移动系统手势退出未实测。
  - 375×812 / 1280×900 下核对中英文设置与工具栏，无横向溢出、热区达标，控制台无错误；正式生产空书架与设置在手机/桌面同样无溢出或报错，手机输入框 16px。
  - 临时库、验证代码、测试比例图、临时构建与预览服务已清理，未触及用户原型存储。已忽略截图：`release/previews/reader-final-remember-mobile.jpg`、`reader-final-desktop.jpg`、`reader-final-formal-mobile.jpg`。
- 真机验收：Swift 编译、6 个 XCTest、iOS 状态栏/Home 指示条及旋转恢复、系统手势、真实导入/封面/删除、缓存/大图、持久化升级、前后台/强杀、捏合与翻页耗时/内存/帧率、iPad 均未测；安卓原生插件仍未实现。构建和 170 个 TS 用例通过不等于 B1/B2 或 M1 真机验收通过。
- 提交交接：用户已提供作者 alex；本次通过 Git 命令临时指定姓名与邮箱，不修改本地或全局身份配置。阶段提交标题为 `M1-09: 正式书架与阅读器阶段收尾`，包含 197 个工程/文档文件；具体提交号以 Git 记录为准，构建产物、测试素材及签名材料未入库。
- 后续：系统分享/“用…打开”、图片文件夹导入等缺口，并在 Mac 补原生及触屏验收。全屏与记住位置不再列作待迁移项。

## 最新检查点：M1 阅读器第三轮，目录、缩略图、书签与阅读外观（2026-10-30）

- 用户授权继续下一轮，按第二轮后的计划完成本轮；分支 `m0`，未提交、未配置作者。前两轮阅读和书架状态保留，不把代码完成写作 M1/B2 已验收。
- 代码实现：
  - 目录根据真实 pageLists 父文件夹生成，移除公共前缀，保持原顺序和起止页；平铺/单一目录仅显示全部页面。章节、缩略图、输入页码均能跳转；缩略图按 48 页分段，打开当前页所在组。
  - 复用原生 ComicArchive.thumbnail（400px 长边、真实 entry），视口附近串行请求、相同请求去重、最多缓存 24 个结果；关闭后丢弃等待和迟到任务，不把预览记入进度。失败显示占位并保留跳页能力；WebView 不读压缩包或原图。目录弹窗暂停后续页面预读，弹窗期间不确认新阅读位置。
  - 书签复用现有表和 bookId 索引，准确保存页码及条漫 offset，一页一个；顶部图标/B 键切换、实时列表、定位、单项删除和故障重试。切换/重复项删除同事务，缺书、不可用或越界拒绝写入；迟到请求不复活书目，不使用末两页完成锚点，也不改 progress/lastReadAt。
  - 新增完整显示/适应宽度、30%–100% 阅读亮度；适宽长页可拖动，亮度只遮罩画面，菜单/错误文字保持原亮度。拖动预览、松手提交，失败还原。可选 fit/brightness 写入 reader.defaults，旧值默认完整显示/100%；不改表/索引或 Dexie v1/v2，不删库。
  - 新增 reader-dimming 语义颜色，新界面中英 i18n，热区至少 44px、手机页码输入 16px。没有新增依赖或原生接口，原型保持独立；正式代码无 Demo/Prototype 引用或演示存储。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过，含 TS strict、Web 构建、iOS 同步及静态隔离检查，不含 Swift 编译。新增 22 个 Vitest（目录/外观 7、书签事务 8、缩略图调度 6、外观持久化 1），累计静态计数 155；按约定本轮未运行 lint / Vitest，现有 6 个 XCTest 未运行，不能记为测试通过。
- 浏览器检查：
  - 隔离真实 IndexedDB＋原生替身：120 页的真实章节与三组预览（1–48 / 49–96 / 97–120）、章节定位第 21 页、输入定位第 50 页、缩略图失败仍可打开真实页。仅预览时进度保持原页；排除书架封面请求后，目录缩略图替身峰值并发 1。
  - 模拟书签写入失败并重试，B 键添加、删除单项保留其他书签；准确保存/跳回第 4 页约 33.63%，完整刷新后仍保留。默认适宽及 81% 亮度重开恢复，滑块连续拖动、适宽拖动不翻页均核对。
  - 收尾修正“适宽切条漫”覆盖触摸样式的问题；最终静态构建 DOM 核对条漫 touch-action=pan-y。该项不是实际触摸验收。
  - 375×812 / 1280×900 下中英文目录、书签、外观界面无溢出，按钮至少 44px、输入 16px，控制台无错误；平铺图片无虚构章节、英文空书签提示正确。正式生产空书架手机/桌面也无横向溢出或控制台错误。
  - 临时库、验证文件/构建和本轮预览服务已清理，用户原型存储未改。保留已忽略截图 `release/previews/reader-round3-contents-desktop.jpg`、`reader-round3-contents-mobile.jpg`、`reader-round3-bookmarks-mobile.jpg`、`reader-round3-settings-mobile.jpg`；均为比例测试图，不是内置漫画。
- 真机验收：Swift 编译、6 个 XCTest、原生缩略图/缓存淘汰、大目录内存、真实触摸滚动/捏合、亮度手感、前后台/强杀、iPad/旋转与耗时/帧率未测；既有导入、封面和删除的原生验收仍待补，安卓插件未实现。无新 APK/IPA，未测安装包增量。
- 下一步：系统分享/“用…打开”、图片文件夹导入等导入缺口；在 Mac 补 B1 与阅读器触屏/性能验收。全屏、记住位置开关等其余原型选项未迁移，不能把当前接入记作原型功能全部完成。详见 `docs/READING_M1.md`；继续不提交。

## 最新检查点：M1 阅读器第二轮，双页、条漫、下一卷与缩放（2026-10-30）

- 用户授权继续第二轮，分支 `m0`，未提交、未配置作者。第一轮基础阅读与书架状态保留，不把代码接入写成 M1-06～09 全部验收。
- 代码实现：
  - 双页复用既有配对/锚点/RTL 纯逻辑，封面单独或拼合、末尾单张、页码范围、滑块镜像；两张都实际加载才写该组进度，一侧损坏不推进，可重试或跳过后组。
  - 条漫按原生返回比例设置占位，只挂载当前及相邻两页的图；比例/宽度变化保留逻辑页内位置。进度写 offset，完整重开恢复；末两页记末页的原规则保留，跨页映射时清零偏移。修正浏览器核对发现的数值尺寸样式，明确使用 px。
  - 下一卷只从真实同系列、同单位、更大编号且可用的书目中选择最近一卷，允许缺卷、不猜无编号；切卷先保存当前卷并验证目标目录。保存失败留原卷并可重试，目标不可用也留原卷；保留返回书架/系列位置。
  - 中央双击 100%/200%、按钮 100/150/200、捏合 100%–300%、围绕手势缩放，放大拖动且不滑动翻页，翻页复位。条漫保留原生纵向滚动并隐藏缩放。默认沉浸与悬浮工具栏保留，工具栏可见时轻点画面只收起。
  - 新增方向、封面与阅读背景设置 UI，模式直接切换。reader.defaults 的可选 spreadCover 兼容旧值，模式增加 spread；当前书覆盖值与默认值同事务保存，失败不改选择。表/索引定义未改，不改 v1/v2、不删库。新文案中英 i18n，语义颜色、至少 44px 热区，无新依赖/原生接口；正式代码无 Demo/Prototype import，原型独立。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过；含 TS strict、Web 构建、iOS 同步及静态隔离检查，不含 Swift 编译。新增 21 个 Vitest（布局/下一卷/缩放 13、设置事务/页内进度 7、三图窗口 1），静态计数 133 个；按约定本轮未运行 lint / Vitest，现有 6 个 XCTest 未运行，不能写作测试通过。
- 浏览器检查：
  - 真实隔离 IndexedDB＋原生替身：封面单独/拼合、RTL 顺序/滑块、末尾单张、半侧损坏不写整组及重试；条漫长图/横图比例与三图窗口、保存第 4 页约 42.78% 后完整刷新恢复。模式/方向/封面/背景持久化、中英 UI 均核对。
  - 第 1 卷跳过不可用第 2 卷进入第 3 卷；模拟保存失败时切卷留在原卷，重试后切换，进度分别保存并返回原系列；最后无下一卷提示正确。按钮缩放、鼠标双击放大/还原、拖动不翻页、RTL 键盘翻页复位已检查。请求真实 entry，替身峰值并发 1，不代表原生性能。
  - 收尾修正倒数第二页处于双页第二侧时的锚点，并补浏览器核对：六页书显示第 4–5 页后退出，真实数据库保存 page=5、offset=0。新增该边界的回归用例，构建重新执行；临时库已清理。
  - 375×812 / 1280×900 截图与 DOM 检查：双页完整显示，工具栏浮于画面，按钮至少 44px，中英无横向溢出、控制台无错误。正式生产空书架桌面/375 无溢出，手机输入框 16px、控制台无错误。
  - 开发模块验证曾超时，切换到独立静态验证构建后完成检查，也补上第一轮未完成的前台保存核对。临时库/图片/验证代码/构建及本轮服务已清理；只保留已忽略截图 `release/previews/reader-round2-mobile.jpg`、`reader-round2-desktop.jpg`。未触及用户原型存储。
- 真机验收：Swift 编译、6 个 XCTest、真实压缩包/原生缓存、触屏捏合/拖动与滑动翻页、条漫清晰度/帧率/内存、前后台/强杀、iPad/旋转仍未测；封面与删除的原生验收未补，安卓插件未实现。无新 APK/IPA，未计安装包增量。
- 下一步：目录/缩略图与书签真实数据接入、适应宽度/亮度等设置，再补原生和触屏验收。详见 `docs/READING_M1.md`。继续不提交。

## 最新检查点：M1 正式阅读器基础闭环（2026-10-30）

- 根据用户“继续做”的授权，完成建议中的第一轮：点书 → 原生加载 → 单页翻页 → 保存进度 → 重开恢复。分支 `m0`，未提交，未配置作者；不把这一轮记为 M1-06～09 全部完成。
- 代码实现：
  - 正式书架单本、系列卷/当前卷、继续阅读和管理弹窗接 Reader。阅读时保留书架挂载状态、原系列、分组、搜索、筛选和滚动位置；背景隐藏并禁止交互，退出恢复原位置。刷新后回书架，再打开恢复持久页码。
  - 读取真实 book/pageLists/progress/settings；缺书、不可用或页目录不完整时明确报错。复用原生 ComicArchive.renderPage 与降采样，从 M0 提取 PageLoader，保留串行、当前及相邻两页、过期任务失效和退出释放；原型兼容导出，正式入口不 import Prototype/Demo 模块。
  - 默认沉浸，悬浮工具栏、左右各 30% 点按、首次说明、横滑、按钮/键盘翻页、滑块跳页、基础卷末与重读。已有 RTL 元数据会对调左右和滑块；背景读取独立阅读默认值，旧 system 暂映射暖纸，white/black 保留。新文案走中英 i18n，颜色只用语义 tokens；阅读背景文字对比度为 9.47 / 11.79 / 11.29:1。
  - 当前图片真正 load 且首次说明确认后才记录，预读和失败页不记进度。progress 与 lastReadAt 同事务保存，末两页统一记末页；支持倒退与时钟回拨，已删除书目不会复活。写入串行，正常退出等待保存；失败可重试或明确不保存返回。pagehide、可见性和现有 Capacitor App 后台事件尝试刷新。
  - 新增说明键 reader.tap-hint-seen，仍用现有 settings 表；不改 v1/v2 schema，不新增依赖或原生接口。详见 `docs/READING_M1.md`。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过；只包含 TS strict、Web 构建、iOS 同步和静态检查。新增 24 个 Vitest（定位/锚点 14、会话/事务/写队列 10），静态计数共 112 个；按约定本轮未运行 lint / Vitest，现有 6 个 XCTest 未运行，不记为测试通过。正式包无原型/演示代码或存储键。
- 浏览器检查：独立真实 IndexedDB、原生接口替身与临时比例图点检首读不写、沉浸/工具栏、按钮与键盘翻页、滑块、损坏页重试与不计进度、保存故障及退出重试、末两页锚点、卷末/重读、返回原系列/书架、完整刷新后从继续阅读恢复第二页、中英文工具栏。请求记录目录 entry 正确，替身请求峰值并发 1。375×812、1280×900 阅读画面与按钮布局 DOM 检查通过，按钮至少 44px，工具栏不改变图片边界，控制台无错误；正式生产空书架桌面/375 检查无横向溢出。截图接口本轮未返回图像，未生成新截图，不记作截图目视验收。临时库、图片和验证文件已清理。
- 真机验收：Swift 编译、6 个 XCTest、真实压缩包页面/缓存淘汰、前后台与强杀持久化、触摸滑动、iPad/旋转、翻页耗时/内存/帧率均未测；上一轮封面与删除原生验收也未补。未生成 APK/IPA，安卓原生插件未实现。
- 收尾复核：新增前台可见性保护后重新构建及 release 检查通过；浏览器补查时本地验证连接超时，未完成这次前台保存重查，不能算作该保护已通过浏览器验收。此前的交互核对结果保留，真实前后台仍待真机检查。
- 下一步：第二轮迁移双页（封面单独、RTL）、条漫和页内位置、下一卷，再接阅读设置、双击/捏合和目录/书签。本轮先完成基础闭环，不声称这些功能已接入；继续不提交。

## 最新检查点：M1-05 正式书架、原生封面与副本删除（2026-10-30）

- 用户授权继续 M1-05；分支 `m0`，未提交、未配置作者。没有新增依赖或原生库；没有修改 v1/v2 schema 定义，原型保持独立。
- 代码实现：
  - 正式书架订阅真实 Dexie 元数据，按系列显示叠放卡片、系列页和卷/话列表；继续阅读最多三本，来自真实 progress。接搜索（含原文件名）、状态/收藏/分组筛选、自然排序、最近阅读页、网格/列表及设置持久化。
  - 管理弹窗接文件信息、单本/系列标记读完与未读、移动分组、二次确认删除；分组可创建/改名/删除。读完保存末页，未读清除进度与阅读时间，书签保留。删除同事务清书目、页目录、进度、书签、作业、同指纹待匹配备份和空系列，并写入 fileCleanup；事务失败整体回滚。
  - 封面复用原生 `ComicArchive.thumbnail`，取第一张可读图片、原生降采样；进入视口附近才请求，横版/长条完整显示，不裁切，失败显示格式占位。WebView 不读取压缩包或原图。
  - 新增原生 `disposeBook({bookId,deleteCopy})`，与渲染串行，释放归档、清缓存，只按 UUID 删除固定 ComicLibrary 目录的 `.zip/.part` 普通副本，拒绝符号链接和越界；原位文件只清缓存。FileCleanupQueue 在数据库事务提交后调用，失败保留任务并支持重开/主动重试，不动用户原文件。
  - 导入面板复用 ImportQueue 全部状态、百分比/大小/取消及清理提示；完成记录可清除，待清理记录保留。首次空书架只说明当前支持的 ZIP/CBZ 导入，不带演示内容或未实现功能入口。
  - 手机书架/最近/设置底栏、平板图标栏、桌面侧栏；外观默认跟随系统并可持久选择浅/深色，阅读背景独立。新文案走中英 i18n，新样式只用语义 tokens；图标抽成纯组件供原型与正式共用，正式代码不 import Demo 模块。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过；含 TS strict、Web 构建、iOS 同步和静态检查，不含 Swift 编译。新增 18 个 Vitest（视图 7、事务/清理 11），静态计数共 88 个；新增 2 个 XCTest，共 6 个。按约定本轮未运行 lint / Vitest / XCTest，不记为测试通过。release 检查通过，正式包无原型入口、Demo 文件或演示存储键。
- 浏览器检查：隔离真实 IndexedDB 点检系列页、批量已读、分组创建/移动/改名/删除、收藏、原文件名搜索、列表/排序/外观重开持久化、中英文、单本删除及清理失败重试；6 项数据核对通过，含删除事务失败回滚。原生使用替身，封面为仅用于比例核对的临时测试图，不能记作真实原生导入/封面/删除验收。测试库及临时文件已清理。正式生产构建在桌面 1280×720、手机 375×812、平板 720×900 检查空书架和响应式导航，无横向溢出、控制台错误；按钮不少于 44px，手机输入框 16px，横版/长条缩略图完整显示，搜索占位文字使用语义次要文字色。
- 真机验收：未做 Swift 编译、6 个 XCTest、原生缩略图与缓存淘汰、真实副本删除和失败重试、真机导入/中断清理、跨进程持久化、iPad、翻页性能或捏合手势；原生代码安装包增量待 Mac 记录，未生成 APK/IPA。安卓原生插件未实现。
- 范围与下一步：正式阅读器属于 M1-06～09，尚未接入；单本、当前卷和继续阅读卡片本轮打开真实书目详情，不能当成阅读已可用。后续将这些入口接正式原生阅读器和进度。详见 `docs/SHELF_M1.md`。按用户要求先不提交。

## 最新检查点：M1-04 Dexie v2、系列入库与分组持久化（2026-10-30）

- 用户确认迁移方案后完成数据层第一步；分支 `m0`，未提交、未配置作者。本轮没有新增依赖或原生接口，正式书架和阅读器界面尚未迁移。
- 代码实现：
  - 保持 `schemaV1` 原文不变，新增 Dexie v2 升级事务。增加 `libraryGroups`、预留 `fileCleanup`，共十表；系列增加唯一键、分组与收藏字段，导入表增加 `bookId` 索引，书籍增加原文件名与卷/话单位。新安装直接建 v2，未来版本拒绝打开保护保留。
  - 旧书从已完成导入记录回填原文件名，缺少来源保留 `null`；识别系列及卷/话，保留旧书名、人工卷话号、有效系列关联及空系列。重名旧系列稳定合并并重定向书目，保留隐藏状态与时间。进度、书签、路径、设置、页目录及待匹配备份不丢失；失败整体回滚。
  - `ImportQueue` 在指纹查重后，用 `parseComicName / seriesKey` 解析并复用系列；系列、书籍、页目录和完成状态同事务提交。卷号写 `volume`，话号写 `chapter`；后续卷保留分组、收藏和隐藏属性，重复或失败不留下孤立系列。
  - 分组采用独立表，理由是需要稳定 ID、唯一名称、顺序和跨系列事务。新增创建、改名、移动系列和删除分组 API；系列级 `groupId=null` 为未分组，删组只移回未分组，不删书/进度/书签/文件。名称按原型限制 20，去多余空白并对全半角/大小写去重。详见 `docs/DATABASE_V2.md`。
  - release 静态检查补充交互原型入口、Demo 模块文件名和 `weiguang.interactive-prototype.v1` 演示存储键检查；原型保持独立可构建。
- 自动检查：`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 全部通过（TS strict、Web 构建、iOS 资源同步及静态检查）。只格式化本轮修改文件；未运行 lint / Vitest。新增 22 个用例（升级 9、分组 9、导入 4），并更新已有数据库/导入断言；静态计数共 70 个，不能记作 70 个已通过。用户报告的上轮基线为 48 个通过。
- 浏览器检查：使用独立临时库完成 12 项真实 IndexedDB 核对，包括 v1→v2、旧数据保留、系列合并、分组去重/改名/移动/重开、删组回滚、导入并组/重复/失败回滚；导入的原生接口为替身，不代表真实文件导入通过。临时库和验证页面已清理。正式构建 `127.0.0.1:4178` 在桌面 1280×720、手机 375×812 下空书架正常，导入按钮 44px 且在无原生插件时禁用，无横向溢出，控制台无错误。
- 真机验收：本轮未做 Swift 编译、XCTest、iOS 旧库升级与跨进程持久化、真实导入/中断清理、翻页性能、捏合手势、iPad 实机；未生成 APK/IPA。`fileCleanup` 只有表与类型，原生删除尚未实现。
- 下一步：M1-05 正式书架，按原型接系列页、分组/筛选/排序、封面、继续阅读与管理弹窗，再推进正式阅读器和进度。本轮按用户要求停止在数据层，不提交。

## 最新检查点：P2 设计变量合并（2026-10-30）

- 把交互原型的颜色与字体合并进正式 `src/styles/tokens.css`，正式 App 与原型共用一套语义变量；分支 `m0`，未提交。
- 代码实现：
  - `tokens.css` 的 paper / night 主题改用原型配色，并新增 `--surface`、`--surface-muted`、`--border`、`--accent-hover`、`--accent-soft`、`--on-accent`、`--positive`、`--banner`、`--danger`、`--on-danger`、`--progress`、`--scrim`、`--shadow` 及阅读背景 `--reader-paper/white/dark`。保留原有 `--bg`、`--fg`、`--fg-muted`、`--accent` 名称与 eink/green 主题、字体、高亮变量。
  - 对比度：原型浅色的次要文字 #83877c（3.4:1）与强调色 #ad6048（4.3:1）低于 4.5:1，改为 `--fg-muted #696d62`、`--accent #a2563e`，在页面、卡片、侧栏三种底色上均不低于 4.5:1；深色主题按钮文字改为深色 `--on-accent`（6.4:1）。数值已按 WCAG 公式计算。
  - 原型：入口引入 `tokens.css`，外观写入 `data-theme`（与正式入口一致）；`demo.css` 删除私有调色板，变量统一改名（`--paper/--ink/--muted/--line/--green/--sidebar/--demo-sans/--demo-serif` → `--bg/--fg/--fg-muted/--border/--positive/--surface-muted/--font-sans/--font-serif`），主按钮、焦点框、危险操作、阅读背景、进度条、遮罩、滑块与开关改用语义变量。封面、插画、阴影等装饰色保留在原型样式中。
  - 正式 `base.css` 的 `--line` 改为引用 `--border`。正式 App 浅色/深色背景、文字和强调色随之变为原型配色。
- 自动检查：`pnpm build:prototype` 与 `pnpm build` 通过（TS strict + 生产构建）；未运行 lint / Vitest，未重新构建 iOS/安卓同步。
- 浏览器检查（`localhost:4180`，检查后已清除）：1440×900 浅色下 `--bg`、次要文字 rgb(105,109,98)、主按钮 rgb(162,86,62) 生效；375×812 深色书架、管理弹窗主按钮（深字浅底）、阅读器背景跟随阅读设置；无控制台错误。正式 App 页面未在浏览器中目视检查。
- 下一步：原型确认后，迁移书架/阅读器到正式数据库与原生渲染时直接使用这些变量。

## 最新检查点：手机底部标签栏恢复（2026-10-30）

- 竞品调研（YACReader、Panels、Apple Books、Mihon、Komic；依据为官方说明、更新日志和商店页面，未逐个核对截图，未覆盖国内 App）显示手机端普遍保留底部标签栏，书库之外通常还有“最近 / 正在阅读 / 历史”和“设置 / 更多”。用户确认后恢复底栏，修订上一节“去掉底栏”的做法。
- 代码实现：手机（≤580px）底栏为 书架 / 最近 / 设置；恢复“最近阅读”页（只列读过的系列，按最近阅读时间排序，不显示继续阅读卡片），桌面侧栏同步为 书架 / 最近阅读 / 我的收藏。收藏仍是书架筛选；导入仍在手机顶栏“+”；去掉手机顶栏的设置按钮。底栏文字 11px，提示条与内容底部让出底栏和安全区高度。
- 追加：“最近阅读”页精简筛选栏，只保留 全部 / 阅读中 / 已读完 与网格/列表切换，去掉恒为 0 的“未读”、收藏开关、分组和排序（固定按阅读时间）。
- 自动检查：`pnpm build:prototype` 通过；未运行 lint / Vitest。
- 浏览器检查（`localhost:4180`，检查后已清除）：375×812 底栏 67px 位于底部，三项切换与选中态正确，最近页 3 个系列，顶栏为搜索/深浅色/导入，无横向溢出，无控制台错误。真机未测。

## 最新检查点：交互原型 P1 调整（2026-10-30）

- 按评审建议的 P1 修改浏览器交互原型；分支 `m0`，未提交。阅读器 P0、书架 P0 的改动保留。
- 代码实现：
  - 外观：新增“跟随系统”并设为默认，监听系统深浅色变化；顶栏切换按钮按当前实际外观切到相反的明确外观。已保存过“暖纸色”的旧演示数据保持原选择。
  - 导航精简：去掉“最近阅读”页（由“最近阅读”排序和继续阅读卡片承担），“我的收藏”改为书架筛选（筛选行的“收藏”开关，侧栏保留快捷入口）。手机去掉底部标签栏，顶栏改为搜索、深浅色、导入“+”、设置；设置页顶栏为关闭按钮回到书架。平板 581–800px 沿用图标侧栏，不重复显示顶栏按钮。
  - 手机首屏：页面标题区在手机上只保留给读屏（顶栏已显示标题），筛选行可横向滑动；375×812 首屏可见继续阅读和第一排封面。
  - 文案：去掉英文眉题和各页口号；侧栏、导入弹窗、设置中的装饰性文案改为直白说明（如“只读你自己的文件 / 不联网，不需要账号”“导入漫画”“数据只在这台设备上”）。搜索占位改为“搜索漫画”。
  - 字号：侧栏计数、筛选计数、页脚、排序、目录/书签、导入说明、阅读器标题副行与底栏等功能性文字统一不小于 11px；手机搜索框 16px，避免 iOS 聚焦放大。封面上的装饰字不在此列。
- 自动检查：`pnpm build:prototype`（含 TS strict）通过；未运行 lint / Vitest（用例数仍为 48），未重新构建 iOS/安卓。
- 浏览器检查（`localhost:4180` 独立源，检查后已清除）：375×812 系统深色时自动深色、无底栏、顶栏“+”与设置、收藏筛选只剩 3 个系列且隐藏继续阅读、设置往返、可见功能文字无小于 11px、无横向溢出；1440×900 系统浅色时自动浅色、手动切换后保存为明确外观、仅 `/` 快捷键提示为 10px；720 宽只显示搜索与深浅色按钮；无控制台错误。真机 iOS 未测。
- 下一步：剩余 P2 为设计变量与正式 `tokens.css` 合并（迁移时处理）；原型确认后开始把书架/阅读器迁入正式数据库与原生渲染。

## 最新检查点：交互原型书架 P0 调整（2026-10-30）

- 按评审建议的书架 P0 修改浏览器交互原型；分支 `m0`，未提交。上一节阅读器 P0 的改动保留。
- 代码实现：
  - 系列归组：书架按文件名识别的系列显示，多卷为叠放卡片（卷/话数、读到第几卷、已读完数），点开进入系列页（卷列表、继续阅读、收藏、分组、管理）；单卷仍直接打开阅读器。阅读器返回时回到所属系列页。收藏改为按系列记录，旧的按书目收藏自动迁移。
  - 真实感样本：设置页可切换“精选 8 本 / 真实文件名 60 本 / 首次打开”。真实样本为 16 个系列 60 本，含混乱命名（`[社团] 名称 Vol.01 (年份) [扫图组]`、`_v07`、`【汉化】`、`第7话`、`Ch.01`、`#2`、`- 01`）、缺卷、横版/长条封面（完整显示不裁切）、无封面占位、320 页大本和超长书名。书名均为虚构。
  - 分组：题材分类改为用户自建分组（侧栏、手机端筛选下拉、系列页和管理弹窗中可新建/移动），另有“未分组”。
  - 继续阅读：大横幅改为最多 3 本的紧凑卡片（竖封面、卷号、页码、进度条），手机端横向滑动。
  - 管理：卡片“更多”打开管理弹窗，显示文件名、格式、大小、页数、进度；可标记读完/未读、移动分组、删除（单卷或整个系列，二次确认说明会清除 App 内副本、进度和书签，不影响原文件）。设置页可恢复已删除的演示书目。
  - 导入进度：导入弹窗的演示入口改为“模拟导入 3 个压缩包”，书架顶部显示导入面板：等待、复制（百分比/大小）、检查、保存、已加入、重复跳过、加密失败、取消。新卷按文件名自动并入已有系列。
  - 首次打开：空书架显示说明（从“文件”导入、从其他 App 打开、自动整理）与“导入漫画 / 先看演示书架”。
  - 触屏（`hover: none`）卡片操作按钮常显；卡片书名、信息字号提高到 11–13px；搜索不区分大小写并匹配文件名；书名排序用数字自然顺序；数百页书的缩略图与条漫页使用 `content-visibility`。
  - 纯逻辑：`src/library/series.ts`（文件名识别系列/卷号/话、系列键、阅读状态、系列状态、按系列归组排序、书名自然排序），新增 `series.test.ts` 共 17 个用例，连同原有共 48 个 Vitest；按约定未运行。
- 自动检查：`pnpm build:prototype`（含 TS strict）通过；未运行 lint / Vitest，未重新构建 iOS/安卓。
- 浏览器检查（应用内浏览器，`localhost:4180` 独立源，未触及用户 `127.0.0.1:4180` 的演示状态，检查后已清除）：1440×900 精选书架两套系列叠放、真实样本 16 系列 / 60 本、混合命名合并、长条/横版/无封面显示；系列页 12 卷顺序、单卷管理弹窗、标记读完、删除确认后剩 11 卷；从系列页新建分组并移入；模拟导入 3 个文件后新卷并入系列、重复跳过、加密失败；375×812 首次打开说明、真实样本无横向溢出、分组下拉与卡片操作可见；320 页单本目录只显示全部页面；无控制台错误。触屏长按、iPad 实机未测。
- 下一步：用户试用后决定 P1（导航精简、跟随系统外观、手机首屏密度、文案收敛）或开始把确认后的书架/阅读器迁入正式数据库与原生渲染。

## 最新检查点：交互原型阅读器 P0 手感调整（2026-10-30）

- 按用户确认的评审建议，只改浏览器交互原型的阅读器，书架未动；分支 `m0`，未提交。
- 代码实现：
  - 点按分区：左右各 30% 翻页、中间呼出工具栏；从右向左时左右对调；工具栏显示时轻点只收起工具栏。触屏（`pointer: coarse`）不再显示边缘箭头，桌面保留。
  - 沉浸式：打开即隐藏工具栏；画面始终占满屏幕，顶/底栏浮在画面上，显隐时页面不移动；手机上页面垂直居中。首次进入显示点按分区说明，看过后记入演示存储 `guideSeen`，替代常驻提示文字。
  - 双页：封面默认单独一屏，可在设置里改为与第 2 页拼合（`spreadCover`）；从右向左时前一页显示在右侧；单张页（封面/末页）按单页大小显示；页码显示为“4–5 / 12”。含末页的一组按末页记进度，修正读完判定。
  - 卷末页：翻过最后一页（或条漫底部）显示“本卷读完了”，提供下一卷、回到书架、从头再读；在卷末页向前翻回到最后一页。
  - 缩放：中间区域双击在 100%/200% 间切换并以点按处为中心，双指捏合 100%–300%，按钮在 100/150/200 间循环；翻页复位；放大时禁用滑动翻页、允许横向拖动。条漫隐藏缩放按钮。
  - 进度滑块在从右向左时镜像；本地图片画册不再虚构章节，目录只显示全部页面。
  - 纯逻辑：`src/reader/spread.ts`（配对、定位、进度锚点、显示顺序）、`src/reader/tapZones.ts`（点按分区），新增 `spread.test.ts` 共 9 个用例，连同原有共 31 个 Vitest；按约定未运行。
- 自动检查：`pnpm build:prototype` 通过；未运行 lint / Vitest，未重新构建 iOS/安卓。
- 浏览器检查（应用内浏览器，`localhost:4180` 独立源，未触及用户 `127.0.0.1:4180` 的演示状态，检查后已清除）：375×812 下首次说明、左右点按翻页、中间呼出/收起工具栏、连续两次点按放大/还原、双页从右向左顺序与封面单独、翻到卷末页并记为读完、卷末向前翻回、滑块 `dir=rtl`；1440×900 下桌面箭头可见、条漫末尾卷末页、无控制台错误。脚本模拟的指针事件不等于真机触控，捏合缩放未在触屏实测。
- 下一步：用户试用后再决定书架 P0（系列归组、真实感样本、首次空书架等）。

## 最新检查点：书架与阅读器浏览器交互原型（2026-10-30）

- 用户调整本轮优先级：先完善书架/阅读器界面，做能在浏览器点击的整体原型。本轮按此执行，没有继续增加系统分享或原生导入功能；分支仍为 `m0`，未提交，B1与闸门一仍待验收。
- 新增独立 `prototype.html` 入口及 `ui-prototype` 构建模式，产物写到已忽略的 `prototype-dist/`；正式 App 和 M0 性能原型保持原入口。使用方式见 [docs/UI_PROTOTYPE.md](./docs/UI_PROTOTYPE.md)。当前预览地址为 `http://127.0.0.1:4180/prototype.html`。
- 界面：纸色/朱砂配色、桌面分类侧栏、继续阅读横幅、8本原创矢量画册、封面网格与列表、移动端底栏；补齐分类/最近阅读/收藏、状态筛选、搜索、排序、详情、导入弹窗和偏好设置。
- 阅读体验：原创SVG分镜可实际翻页，支持方向键/空格、水平滑动、单页/双页/条漫、章节目录、缩略图/滑块跳页、书签、下一卷、背景/方向/适应方式/亮度/放大和工具栏显隐。演示进度、收藏、书签、偏好保存到独立localStorage键，不访问正式Dexie库。
- 本地图片体验：仅原型允许选择/拖入JPG、PNG、WebP，一次最多12张，每张8 MB以内，逐张生成最长边1600像素预览；不上传、不改源文件。临时添加的本地图片和演示新画册刷新后移除。全部样张只供原型，不随正式App内置；无第三方漫画来源或远端素材。
- 自动检查：`pnpm build:prototype`、`pnpm build:ios`、`pnpm check:ios --release`通过；正式网页和iOS同步资源未包含交互原型模块、样张或演示存储键。没有新增依赖；正式JS资源与上一轮一致。未运行lint / Vitest，既有22个Vitest保持不变。
- 浏览器检查：应用内浏览器实际完成搜索、未读筛选、网格/列表、收藏、演示画册/本地图片添加、上下页/键盘、刷新恢复、书签/目录跳页、单双页/条漫、反向翻页、放大、深色外观和设置操作。390×844书架无横向溢出，可见按钮至少44×44px；桌面/移动端截图已保存，控制台无错误。使用独立4181检查端口，未修改用户4180页面中的演示状态。
- 产物：`release/previews/interactive-shelf-desktop.png`、`interactive-reader-desktop.png`、`interactive-shelf-mobile.png`、`interactive-reader-mobile.png`（均已忽略）；4180服务保留供用户体验，4181检查服务关闭。
- 下一步优先根据用户体验反馈调整原型，再迁移确认后的UI到正式数据库与原生渲染。正式阅读器、进度保存、系统分享、文件夹整理和安卓插件尚未因本原型而完成；Mac编译、真机功能/性能与闸门仍单独待办。

## 最新检查点：M1-02/03 ZIP 正式导入代码准备（2026-10-30）

- 在当前聊天继续开发，已读取交接文档、历史检查点和工程；PRD 与计划的 Claude 外链本轮仍无法访问，按交接摘录实现。分支保持 `m0`，保留全部原有文件，未提交；B1 和闸门一仍待 Mac/Xcode 与真机验收。
- 代码实现：
  - 新增正式 `ComicImport` TS/Swift 接口：系统多选 ZIP/CBZ、逐文件 1 MiB 分块复制、按作业 ID 上报进度和取消。选择授权只保留在当前原生进程，WebView 拿不透明标识，不接收外部路径或文件体。
  - 正式副本写入 Application Support / `ComicLibrary/`，先写 UUID `.part`，完成后改名为 `.zip`；排除整机备份。原型仍只管理 `ComicPrototype/`，原型清理不触及正式书架。两类副本均可由已有 `ComicArchive` 读取。
  - `src/library/ImportQueue.ts` 串行执行复制、指纹检查、ZIP 目录检查和页序建立；书籍、页目录、完成记录在同一 Dexie 事务提交。拒绝加密包、空图片目录及无效复制结果；单个文件失败后继续后续文件。
  - 已接取消、失败提示和中断恢复：重开时保留已入库副本，清理未完成副本并提示重新选择；清理失败保留 `cleanupPending`，下次打开重试。当前不做字节级续传或跨进程自动恢复外部文件授权。
  - 按既定内容指纹跳过已存在记录，并清理本次多余副本；这是基础去重，文件夹分类、系列归组和完整 M1-04 尚未实现。
  - 正式书架显示导入结果（书名、页数）与导入记录，包含等待、复制、检查、保存、完成、重复、失败、取消状态；中英文文案、长文件名换行和至少 44px 热区已接入。封面网格、正式阅读器与阅读进度仍待后续任务。
  - 新增 8 个导入回归用例，覆盖入库持久化、重复文件、加密包失败后继续、事务失败回滚、复制/目录检查时取消、重启清理重试、迟到/倒退进度。连同原有用例共 22 个 Vitest，按约定未运行。
- 自动检查：`pnpm build:android`、`pnpm build:ios:prototype`、`pnpm build:ios`、`pnpm check:ios` / `--release` 通过，包含 TS strict 和两端网页同步，不含 Swift/Gradle 编译。M0 网页产物未包含正式书架/导入模块，最终 iOS 同步内容为正式网页。未执行 lint / Vitest。
- 桌面界面检查：Chrome 390×844，空书架和虚构记录下的结果列表、复制状态、错误提示无横向溢出，按钮高度 44px、控制台无错误；验证数据已移除。截图在已忽略的 `release/qa/import-ui-check-20261030.png`。此项只验证界面，不验证原生文件复制或导入性能。
- 依赖与体积：没有新增 JS 或原生库。正式网页 JS 合计 146,858 字节、gzip 51,282 字节，比上一检查点 gzip 增加 6,838 字节；原生代码带来的安装包增量仍待 Mac 构建测量。
- 未验收范围：Swift 编译、系统文件选择、跨进程中断清理、iOS IndexedDB 与实际导入均待真机；安卓正式原生插件仍未实现，桌面/安卓不会启用无原生支持的导入按钮。尚无新版 APK/IPA，本轮安卓命令只构建和同步网页。
- 下一步：先补 M1-03 的系统分享/“用…打开”入口及其待接收队列，再做 M1-04 图片文件夹导入与整理；随后接正式封面书架、阅读器和进度保存。继续在 Windows 准备代码，Mac 验收单独待办。正式 ZIP 导入验收步骤见 [docs/IMPORT_M1.md](./docs/IMPORT_M1.md)。

以下检查点保留历史过程；当前状态以本节为准。

## 当前执行方式：Windows 继续代码准备，Mac 验收单独待办（2026-10-29）

- 用户确认目前没有可用 Mac。已修正此前将所有开发停止的处理：可以继续完成与原生性能结论无关的界面、存储和纯逻辑代码；B1、性能闸门及 iOS 真机验收继续标为待办，不视为通过。
- 本轮预先实现 M1-01 数据库基础，工作区仍为 `m0`、未提交，未做 M1 验收：
  - `src/db/models.ts` 定义书籍、系列、页目录、进度、书签、导入作业、设置和待匹配恢复记录。数据库只存记录，未存漫画文件或原图。
  - `src/db/schema.ts` 建立计划中的8张表与索引；首次建库写默认设置。v1定义保留，后续变更新增版本及升级逻辑，禁止删库重建；当前没有虚设v2迁移。
  - 正式书架入口先打开数据库；打开失败显示重试入口，不清除数据。原型与正式入口按构建模式分开，M0产物不含数据库书架模块。
  - 新增3个数据库回归用例：首次建库、重开后保留用户数据/设置、遇到未来版本拒绝打开且不删库；连同此前用例共14个 Vitest。按约定未执行 lint / Vitest。
- 新依赖：Dexie **4.4.6**，按既定数据库选型提供 IndexedDB 表、事务与版本迁移。独立压缩发行文件96,163字节、gzip30,951字节；本轮正式网页全部 JS 合计127,764字节、gzip44,444字节（包含接入代码）。fake-indexeddb **6.2.5** 仅作测试依赖，不进入App产物；没有新增原生库。
- 自动检查：`pnpm build:ios`、`pnpm build:ios:prototype`、`pnpm check:ios` / `--release` 通过；已确认M0原型产物不含 `LibraryApp` 模块。浏览器正式产物首次打开和刷新均能进入空书架，错误日志为空。此项不代替 iOS IndexedDB 持久化与升级验收。
- 尚未实现正式导入、书架内容展示与正式阅读进度。下一步可在 Windows 准备 M1-02/03 的正式原生接口、导入状态与持久化衔接，再接书架和阅读器；各项代码检查与 Mac 验收分开记录。
- 当前系统 goal 之前已标记 blocked；本轮实际继续了代码准备，Mac 编译和真机验收仍受环境限制。下面的“当前阻塞”记录为此前检查点，不再表示代码开发必须停止。

## 当前阻塞：B1 需要 Mac/Xcode（2026-10-29）

- iOS goal 标记为受阻，目标尚未完成。连续检查确认本机没有 `xcodebuild`、`xcrun`、`swift`、`swiftc`，尚未提供可连接的 Mac 或 B1 执行结果。
- 已完成的 M0-05 代码、构建结果和 4.903 GiB 测试素材均保留；没有新增代码变更或重复运行已通过的构建。
- 后续 iOS 步骤依赖 B1：先编译 Swift、运行 XCTest，再用 iPhone 12 / iPad 第9代记录首图、翻页、滚动与 App + WebContent 内存；安装包增量也待测。网页构建、静态检查和素材 CRC 不能替代这些结果，闸门一仍未通过，M1 未开始。
- 恢复条件：提供可用的 Mac 执行环境，或按 [B1 说明](./docs/IOS_B1.md) 在 Mac 上运行并回传编译日志、测试及性能结果；届时从 B1 继续，不重做已完成部分。

## 续开发检查点：原型修复与 ZIP64 素材（2026-10-29）

- 复核后继续完善 M0-05，没有越过闸门一进入 M1；当前仍为 `m0` 未提交工作区。
- 代码修复：
  - 失败重试清空 TS 页地址与原生缓存，再重新解码；新生成的页面地址带本地缓存版本，避免复用失效响应。
  - 页调度拒绝旧版本缓存命中、丢弃退出后的迟到结果，并把可加载范围限制为当前页及相邻两页；某页失败不阻断后续读取。
  - 条漫观察器改用视口高度计算像素中线，随尺寸变化重建，修正百分比边距按宽度计算导致的横屏跟踪问题。
  - 书架与阅读器增加 `vh` 高度回退，保留支持时的 `dvh` 动态高度。
- 测试用例：新增6个页调度并发/失效/退出/恢复用例、1个横竖屏中线用例；连同已有页面列表4例，当前11个 Vitest 用例。按约定未执行 lint / Vitest；原生 XCTest 仍未执行。
- 素材验证：`test-books/big-4gb-2000p.zip` 已生成，真实大小 **5,264,533,542字节（4.903 GiB）**，包含2000张4000×6000 JPEG和1条非图片填充。首图偏移4,294,967,379，末图偏移5,263,906,508；所有图片均跨过4 GiB边界。Python `zipfile.testzip()` 全条目 CRC 通过，首/中/末三图均成功解码；证据在已忽略的 `test-books/ZIP64_VERIFICATION.json`。此结果只验证素材完整，不是 iOS 读取性能结论。
- 自动检查：修复后 `pnpm build`、`pnpm build:ios:prototype`、`pnpm build:ios`、`pnpm check:ios --release` 均通过；正式网页 JS gzip 10.73 KB、CSS gzip 0.98 KB，原型资源未混入正式网页。`git check-ignore` 确认大包与验证记录均被忽略；无新增依赖。
- 当前缺口：再次检查本机无 `swift` / `swiftc` / `xcodebuild`。Swift 编译、XCTest、安装包增量和 iOS 真机性能仍无法在本机完成；已询问用户 B1 的 Mac 执行方式，尚无结果。

## 最新检查点：M0-05 iOS 原型（2026-10-29）

- 当前分支 `m0`，尚未提交；保留原有未提交工程。goal 已创建：按计划推进 iOS App；当前停在 B1 原生编译与真机性能验收前，未完成整个 App。
- 已读本地 README、AGENTS、CODEX_HANDOFF 与原检查点。PRD 和开发计划的 Claude 原文链接需要登录，本次网页访问停在登录页；开发依据是交接文档摘录，未声称读完原文。
- 代码实现：
  - iOS 工程已生成，最低 iOS 15，iPhone / iPad，Bundle ID `dev.weiguang.comic`；本地 `ComicNative` Swift package 直接链接 App，双入口使用自定义桥注册插件。
  - ZIP/ZIP64 目录读取与原始名字节、加密识别、流式按页解压、CRC 校验、ImageIO 降采样、500 MiB 页面缓存淘汰、指纹与缓存清理。
  - 原型专用系统文件选择、1 MiB 分块复制、进度/取消、排除整机备份、只清理原型副本；用户原文件保持只读。
  - 最简翻页/跳页/条漫、相邻页预读、手选旧文件名编码、基础数字自然排序、近似时间与帧间隔采样。正式导入、Dexie、进度保存等 M1 功能尚未实现。
  - 普通 iOS 网页构建排除原型页面，原生原型插件仅 DEBUG 注册；生产 CSP 阻断网页对外连接。新增原生依赖 ZIPFoundation 0.9.20（MIT；理由及安装包增量待测项见 B1 说明），无新增 JS 运行时依赖。
  - 修正大包素材生成器：`--big` 写入 4 GiB 填充，保证图片真实偏移超过32位边界；未执行大包生成。
- 自动检查：
  - `pnpm build:ios:prototype` 通过：TS strict、Vite、Capacitor 同步，**不含 Swift 编译**。
  - `pnpm build:ios` 通过；正式网页 JS gzip 10.73 KB、CSS gzip 0.97 KB。
  - `pnpm check:ios --release` 通过：pbxproj 解析、源文件编译引用、Swift 包链接与路径、双入口桥、最低系统、隐私清单、离线 CSP、正式网页排除原型资源。
  - Python 素材脚本语法检查、`pnpm test-books` 通过，生成普通素材；清单14条（含目录和未生成RAR占位），`large-200p.zip` 实际11,366,930字节，不能充当1 GB或4 GB性能包。
  - 纯逻辑 Vitest 已补4个用例；原生目录解析 XCTest 已补4个用例。按约定未运行 lint / Vitest，Windows 无法运行 XCTest。
- 桌面预览：Chrome 390×844 原型首页无横向溢出，按钮高度44px、控制台无脚本错误；文件读取在桌面禁用。此项不等于 iOS 阅读器验收。
- 真机验收：全部未做；当前 Windows 无 Swift / Xcode。ZIPFoundation 的原生编译、安装包增量、4 GB 随机读页、首图≤1秒、翻页≤100ms、长条漫60fps、App及WebContent内存峰值≤400MB均待 B1 实测。长条漫当前限400万像素，清晰度和跨页高度变化也需实测。
- 闸门：M0-05 为“原型代码已写，待原生验证”，M0-06 安卓原型未开始，M0-07 闸门一未通过；未越过性能闸门进入 M1。
- 下一步与具体命令：见 [docs/IOS_B1.md](./docs/IOS_B1.md)。先 Mac 编译、运行原生测试和真机采样，回填结果；闸门一评审时运行全部 Vitest，达标后进入 M1。

以下为本次开发前的历史检查点，不代表最新状态。

## M0 检查点（2026-10-29）

- 分支与提交：尚未提交（`git init` 已完成，等你验收 M0-04 后按任务编号提交）。
- 已完成任务：
  - M0-01 竞品差评整理：收费方式、卡顿闪退两个切入点反复出现，闸门一差评条件通过。
  - M0-02 关键词调研：主攻词与避开词、三套商店文案；搜索热度待用 Apple Search Ads 补查。
  - M0-03 测试素材脚本：`scripts/make_test_books.py`，13 组素材；RAR 样本缺 WinRAR 未生成，4 GB 大包需加 `--big`。
  - M0-04 新工程初始化：见下。
- 代码实现（M0-04）：
  - 从微光阅读复制工程骨架：Vite 8、Preact、TypeScript strict、Signals、ESLint、Prettier、Vitest、Capacitor 8。
  - `appId` / Bundle ID `dev.weiguang.comic`，名称「微光漫画」；空书架页，中英文框架，跟随系统深浅色。
  - 安卓工程已生成，显式移除 INTERNET 权限；项目路径含中文，已加 `android.overridePathCheck=true`。
  - 未加 PWA（首版不做网页版）；未生成 iOS 工程（需在 Mac 上 `cap add ios`，放到 B1 批次）。
  - 图标仍是 Capacitor 默认占位。
- 自动检查：`pnpm build`（类型检查 + 生产构建）通过；未跑 lint 和 Vitest（按约定）。
- 安卓调试包：`assembleDebug` 成功，`app-debug.apk` 约 4.1 MB，合并清单无 INTERNET 权限。
- 真机验收：未做。安卓调试包需要你装到真机确认能打开空书架。
- 环境问题：本机全局 Gradle 缓存（`C:\Users\a1382\.gradle\caches\8.14.3`）大面积损坏，本项目改用独立的 `.gradle-home/`（已忽略）。已删除全局缓存中可再生的 `groovy-dsl` 目录。
- 下一步：M0-05 iOS 性能原型（需 Mac，B1 批次）、M0-06 安卓性能原型。
