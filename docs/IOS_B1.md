# B1：iOS 性能原型交接

更新：2026-10-30。M0-05 已写入原型代码，尚未经过 Swift 编译与真机验收，闸门一未通过。继续开发前先读 `CODEX_HANDOFF.md`、`DEVELOPMENT_STATUS.md`。M1 正式 ZIP/CBZ 导入代码已预先准备，另见 [M1 导入说明](./IMPORT_M1.md)；本页仍用于 M0 性能原型验收。

## 本批代码范围

- iOS 15 / iPhone 与 iPad 工程，Bundle ID `dev.weiguang.comic`。
- `ios/ComicNative` 是独立本地 Swift package；App 直接链接它，不修改 Capacitor 自动生成的 `CapApp-SPM/Package.swift`，同步不会抹掉自有插件。
- `ComicArchive`：读取 ZIP/ZIP64 中央目录、保留非 UTF-8 原始文件名、识别加密、按条目读取、CRC 校验、ImageIO 降采样、内容指纹、缓存清理。
- `ComicPrototype`：系统文件选择、1 MiB 分块复制、复制进度与取消、清理本批原型副本；仅在 Xcode `DEBUG` 条件下注册。原型不使用正式作业数据库，正式导入和中断清理由独立的 `ComicImport` / `ImportQueue` 管理；系统分享入口尚未实现。
- TS：图片过滤与基础数字自然排序，手动选择 GB18030 / Big5 / Shift_JIS；最简按钮翻页、跳页与条漫；相邻页预读；打开与翻页计时、动画帧间隔采样。
- 应用副本在 Application Support / `ComicPrototype/`，目录和文件均排除整机备份。页面在 Caches / `ComicPages-v1/`，按最近访问淘汰，PNG 与元数据合计上限 500 MiB。用户原文件只读。

## 在 Mac 上构建

把完整工作目录复制到 Mac（或在用户验收后提交并拉取代码），不要只拷贝 `src/`。不用复制 `node_modules`、`.gradle-home`、`dist` 或测试书。不要执行 `cap add ios`，工程已存在。

1. 安装 Node >=22.12、项目规定的 pnpm、支持 Capacitor 8 的 Xcode，完成 Xcode 首次启动。确认 `xcode-select -p` 指向 Xcode。
2. 项目根目录执行：

   ```sh
   pnpm install --frozen-lockfile
   pnpm build:ios:prototype
   pnpm check:ios
   pnpm exec cap open ios
   ```

3. 首次 Xcode Resolve Package Dependencies 需下载构建依赖；运行中的 App 没有远程资源或请求。Xcode 选择 App target 的签名团队、iPhone / iPad，使用 Debug 构建启动。网页模式和原生 `DEBUG` 条件缺一均无法使用原型导入。
4. 无签名的模拟器编译可在根目录先执行：

   ```sh
   xcodebuild -project ios/App/App.xcodeproj -scheme App \
     -configuration Debug -sdk iphonesimulator \
     -destination 'generic/platform=iOS Simulator' \
     -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
   ```

5. 在 Xcode 打开 `ios/ComicNative/Package.swift`，选择 iOS 模拟器并运行 `ComicNativeTests`。现有 8 个 XCTest：ZIP 目录 4 个（普通 ZIP、ZIP64 标记与扩展字段、原始编码字节与加密、截断与越界）、副本删除 2 个、旧容器路径重新定位与拒绝越界/符号链接 2 个。当前 Windows 没有执行这些测试。闸门一时还要执行全部 Vitest，当前共 171 例。

工程使用 SceneDelegate，在它和 Main.storyboard 中都指定 `ComicBridgeViewController`。若出现 “plugin is not implemented”，先检查是否误用了 `CAPBridgeViewController`，以及原型网页是否通过专用命令构建。

`pnpm build:ios` 只构建网页并同步 iOS 资源，不执行 Swift 编译、不签名、不生成 IPA。正式网页不包含原型页面：

```sh
pnpm build:ios
pnpm check:ios --release
```

## 素材与操作

普通素材生成：`pnpm test-books`（Python 3 + Pillow）。当前已在 Windows 执行，`test-books/MANIFEST.json` 有 14 条清单记录，含图片目录与未生成 RAR 的占位记录；RAR 仍缺 WinRAR。

大包生成命令：`python scripts/make_test_books.py test-books --big`。生成器先流式写 4 GiB 非图片填充，再写 2000 页，保证图片的真实偏移跨过 4 GiB。需要预留至少约 6 GB 工作磁盘。当前 Windows 已生成 `test-books/big-4gb-2000p.zip`：5,264,533,542字节（4.903 GiB），2000张4000×6000 JPEG，首/末页偏移分别为4,294,967,379和5,263,906,508。全条目 CRC 与首/中/末页图片解码通过，详见 `test-books/ZIP64_VERIFICATION.json`；这不证明原生插件已通过验收。不要把素材打进 App 或提交 Git。

将测试文件放入设备「文件」中的本地目录，避免云盘下载耗时混入导入测量。每组执行：

1. 打开原型，选择 ZIP / CBZ，等待复制完成；核对页数、第一页和页序。
2. 上下页连续翻、跳到中间与末页；返回原型首页查看打开与翻页计时。
3. 返回后点「清除此书页面缓存」，重新打开，测量无页面缓存的读取；再重新打开测已有缓存的读取。
4. 切条漫模式，连续滚动；跨页后回滚、跳页，观察比例变化和占位高度变化是否引起跳动。原型没有完成 M1 的进度保存或完整的条漫定位。
5. 重复进入退出并测试取消复制；横竖屏切换后核对条漫页码继续跟随视口；坏页重试时应重新解码，不复用旧地址。删除本批副本后检查存储是否释放、原文件是否仍完整。
6. `corrupt-page-05.zip` 的坏页应显示错误且允许继续翻页；无图片包与加密包应提示原因。加密 ZIP 需在本地创建测试包，现有脚本只提供加密 RAR（M2 才支持）。

测试文件名见 `MANIFEST.json`，不要凭本说明猜文件名。自然排序目前只处理阿拉伯数字；中文数字话数、番外顺序与自动编码识别按计划留在 M2。

## 测量与记录

目标设备：iPhone 12、iPad 第 9 代。iOS 性能原型达标后才评审 M0-07；安卓 M0-06 仍需另做。

| 项目                     | 方法与判定                                                                            | 本次结果                 |
| ------------------------ | ------------------------------------------------------------------------------------- | ------------------------ |
| 冷启动到书架             | 正式网页 + Instruments App Launch，≤1.5 秒                                            | 未测                     |
| 大包打开到首图           | 已导入副本，含目录读取、原生降采样、WebView 图片加载；≤1 秒                           | 未测                     |
| 已预读页翻页             | 连续翻页，≤100 ms；记录多次值与最慢值                                                 | 未测                     |
| 长条漫                   | 连续滚动，Instruments Animation Hitches / Core Animation，目标 60 fps、无闪退         | 未测                     |
| 阅读内存                 | 同时观察 App 与关联 WKWebView WebContent 进程的内存峰值，≤400 MB；不能只记 Swift 进程 | 未测                     |
| 1 GB ZIP 导入            | 本地文件，复制与目录校验用时≤60秒；正式 M1 导入链路还需重测                           | 未测，需另备真实 1 GB 包 |
| 缓存淘汰                 | 不同页/分辨率使缓存超过500 MiB，核对最近页保留及清除效果                              | 未测                     |
| ZIPFoundation 安装包增量 | 同 Xcode、SDK、架构、优化配置，对比有/无该库的 App / IPA                              | 未测，待 Mac             |

原型显示的首图与翻页时间在 `img.load` 后额外等待两次 requestAnimationFrame，属于本机近似测量；帧间隔样本含静止帧，不是滚动性能结论。完整性能测量用接近 Release 的优化配置；原型当前仅 Debug 注册，可在本地复制 Debug 配置并保持 DEBUG 标记、开启优化来测，再用最终产品 Release 复核，不能直接用 Debug 数值宣称上线达标。

记录设备型号、系统、Xcode、构建配置、素材真实字节数、缓存状态、各次用时、两类进程峰值及截图/trace 的本地位置。填回 `DEVELOPMENT_STATUS.md`；trace 与漫画样本不提交。

## 已知边界

- 原型只做 ZIP / CBZ；RAR、EPUB、文件夹正式导入、双页、缩放、购买尚未开始。数据库v1基础已在 Windows 预先实现，正式页会打开数据库再显示空书架；尚未接入正式导入与书架内容，需在iOS补测建库、持久化和升级保护。
- 为限制内存，单张缓存最多约 400 万像素、长边最多 8192。800×20000 长条漫会降低清晰度；需要在 M1-07 / M3-05 根据实测决定分块显示。不能以模糊小图的流畅度代替正式可读性验收。
- 单条目解压上限 256 MiB；目录上限十万条、文件名原始字节总量上限16 MiB。暂不支持分卷和加密 ZIP。使用 UUID 临时文件名，绝不按包内路径写出；TS 过滤系统垃圾、链接和不安全路径。
- 原型没有持久化书籍记录；重启后可重新选择样本或清除全部原型副本。后续 M1 数据目录应与本批临时数据分开，不直接把测试目录当正式书架。
- 内容指纹明确字节协议：`SHA-256(十进制文件大小的 UTF-8 + LF + 前 min(1 MiB, 大小) + 后 min(1 MiB, 大小))`；不足2 MiB的文件会有重叠，仍按这两段处理。安卓和后续备份应使用同一协议。

## 依赖与后续顺序

新增原生依赖 [ZIPFoundation 0.9.20](https://github.com/weichsel/ZIPFoundation/tree/0.9.20)，MIT，提供文件句柄下的 ZIP64 随机条目读取、流式解压和 CRC。安装包增量尚无可测值，待 B1 填表，不用源码大小或网页 gzip 大小代替。未引入新的 JS 运行时依赖。隐私原因对应 [Apple 的 Required Reason API 说明](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)：应用容器元数据、应用内用时及应用内设置；没有采集或上传。

没有 Mac 时可先准备后续代码，当前已准备 M1-01 Dexie 基础；这些准备不代表阶段验收通过。验收顺序仍为：Mac 编译并修正原生问题 → B1 真机性能记录 → M0-06 安卓原型与 M0-07 闸门一评审（此时按约定跑全部 Vitest）→ 验收 M1 的双端 ZIP 插件及正式导入阅读链路。
