# 微光漫卷最新交接摘要

## 最新：TestFlight 构建 9（2026-11-05）

用户已授权上传最新模拟器验收版。m0 已快进至 `ce6c79c`，包含网页 QA 六项修复和原生导入自然卷序补修；构建号 8→9，版本仍 0.0.1。本轮 lint、231/231 Vitest、iOS 同步/静态检查、依赖解析、32/32 XCTest、Debug 与 Release 归档全通过，实际签名与之前新建的本机 Apple Distribution 证书逐字节一致（到期 2027-11-03），私钥仍留钥匙串。2026-11-05 12:15:08（UTC+8）已通过 Xcode Apple ID 成功上传，未使用旧 API Key。用户恢复网页登录并明确授权本构建出口合规答案后已保存，最终 0.0.1(9) 显示「准备提交」、90 天后过期、上传时间 12:16，达到网页核验的 VALID 目标；构建 id `f41808a0-3a7b-4c65-bc68-9b51a6506cc6`，截图 `release/qa/build9-appstore-complete.png`。未提交审核或主动添加群组/测试员，构建 9 群组仍待分配。真实设备/内购/性能未执行，本轮未重复完整模拟器交互。详见 DEVELOPMENT_STATUS.md 顶部。

## 最新：模拟器验收与原生导入卷序补修（2026-11-05）

已拉取截图对应 `5987907`（远端 `claude/sharp-allen-0xoaaj`），在 `weiguang-comic-device-qa-20261105` / `codex/device-qa-20261105` 独立验收，m0 仍为 `a081e0c`。无真实 iPhone，用户明确改为「先做模拟器验收」。真实 iOS 桥点检发现多选返回顺序仍使 02 卷排在 01 前，已最小补修为原生文件名自然排序，再由网页 sequence 保持来源顺序；逆序点击后实测最新批次 01→02，重复安全跳过。补修后 lint、231/231 Vitest、iOS 同步/静态检查、32/32 XCTest（新增 2）、Debug 模拟器与真机 SDK 无签名编译全通过。模拟器实际核对英文开启锁说明、后台遮挡/取消/重试/关闭、375 宽中英文空状态与按钮、Pro 无空标题、中文单卷删除含卷号、四格式打开翻页。四本临时书已移除，副本 7→5、引用 2→0、四份原件完整哈希不变，原 5 本/4 系列与第 2/4 页保留。真机、真实内购/退款、性能等仍未执行；Unlock LumiComic 自定义系统说明仅自动测试覆盖，本轮未目视核验。未改构建号/签名，未上传新 TestFlight，仍 0.0.1(8)。详情与证据位置见 DEVELOPMENT_STATUS.md 顶部。

## 最新：网页层验收修复（2026-11-05）

基线 `a081e0c`，分支 `claude/sharp-allen-0xoaaj`。Linux 云端容器内执行，无 Mac/模拟器/真机，未改 Swift、构建号或签名。生产构建 + Chromium 注入 iOS 桥替身，点检中英文与 390/375/1280 宽的导入、阅读三种模式、卷末/下一卷、坏页与原位重选、Pro 购买与四项新功能、批量、隐藏、分组、应用锁。修复 6 项：应用锁系统验证说明未翻译；同批导入记录顺序随机（新增可选 `sequence`，无数据库升级）；系列内删除单卷确认未写卷号；设置按钮在手机宽度被挤成两行；无筛选的空「最近阅读」误提示“换关键词/清除筛选”；全部交付后购买页残留空的“后续更新”标题。lint、231/231 Vitest（新增 4）、build、build:ios、check:ios --release 通过；原生/真机仍未验收。详情与未改观察见 DEVELOPMENT_STATUS.md 顶部。

## 最新：TestFlight 构建 8（2026-11-03）

用户要求把四阶段 Pro 新功能打包上传。基线 `aa7655e`，构建号已 7→8（版本 0.0.1）；227/227 Vitest、lint、iOS 同步/静态检查、依赖解析、30/30 XCTest、Debug 构建及 Release 归档全通过。实际签名与新本机 Apple Distribution 证书逐字节一致（到期 2027-11-03），私钥未导出；沿用同 App 有效描述文件「LumiComic AppStore Build 6」，工程仍 Automatic。Xcode Apple ID 上传 0.0.1(8) 成功，未使用旧 API Key；Apple 网页已显示上传「完成」、TestFlight「准备提交」、90 天后过期，构建 id `14c98d3e-a73d-45fb-8d66-2c628ad00db6`。用户恢复网页登录后补充本构建加密类型信息，未提交审核或主动添加群组/测试员。模拟器更新启动核对原 5 本/4 系列和第 2/4 页保留，Pro 六项已包含；本轮完整交互/真机未执行，上一轮验收记录保留。截图 `release/qa/build8-appstore-complete.png`，详情见 DEVELOPMENT_STATUS.md 顶部。

## 最新：Pro 1.2 第二阶段——画面滤镜与四阶段收尾（2026-11-03）

原位阅读 `3061105`、批量整理 `7ee1a8b`、自动翻页 `98f55f5` 已推送，画面滤镜现已完成每书对比度/锐化/暖色、免费还原与失去 Pro 原图回退。Core Image 只处理渲染图、独立参数缓存、原图无上下文开销、不改原件，无新依赖或数据库升级。227/227 Vitest、lint、iOS 同步/静态检查、30/30 XCTest、Debug 编译通过；首轮英文键语法及测试初始设置假设错误已最小修正，无跳过测试。模拟器原位 CBZ/PDF 效果、每书隔离、重新打开保留第 2/4 页与参数、还原、中英文已核对；两份原件完整哈希不变，临时两本清理，原 5 本/4 系列与进度保留。滤镜已标记交付，四阶段代码/自动检查/模拟器点检完成，本次推送后 goal 结束。真机、性能、实际退款、云盘提供者等仍明确未执行；未中断 Xcode 另一工程调试，未新增 TestFlight（仍 7）。详情见 DEVELOPMENT_STATUS.md 顶部。

## 最新：Pro 1.2 第一阶段——自动翻页（2026-11-03）

1.1 原位阅读 `3061105`、批量整理 `7ee1a8b` 已推送。自动翻页已实现单页/双页间隔与条漫匀速滚动、主动启动和免费停止、后台/交互/坏页/卷末停止、实际加载后计时与保存，不自动跨卷。221/221 Vitest、lint、iOS 同步/静态检查、25/25 XCTest、Debug 编译通过；模拟器核对单页卷末、双页配对、后台 12 秒后同页保持暂停、条漫底部与坏页停止。原生播放常亮、失活/停止/重载恢复；重连原件先 flush 再重开。临时三本清理，原 5 本/4 系列和进度保留，设置恢复。autoplay 已标记交付。真机、单独英文、RTL/旋转、退款中暂停未执行，未归档/上传新 TestFlight。下一阶段画面滤镜，goal active。

## 最新：Pro 1.1 第二阶段——批量整理（2026-11-03）

原位阅读已在 `3061105` 推送 m0。批量整理已实现：冻结选择范围、提交前核对、整批事务回滚、持久安全清理，单项管理/分组仍免费；214/214 Vitest、lint、iOS 同步/静态检查、Debug 编译通过，本阶段未重跑 XCTest（Swift 未改，上一阶段 25/25）。模拟器英文实测自制 2 系列/3 本混合副本/原位书批量已读、移动分组、未读、删除，副本 7→5、引用 1→0，三份原件字节不变；原 5 本/4 系列与进度保留。修复新建分组被旧快照误退回全部、删除确认先聚焦取消，中文实测回车取消。临时分组已清理，语言恢复跟随系统；补查英文原位入口/说明。真机、退款后交互、系列内逐卷模拟器操作未执行。`batch` 已标记交付，未归档/上传新 TestFlight，后续自动翻页与画面滤镜继续，goal active。详情见 DEVELOPMENT_STATUS.md 顶部。

## 最新：Pro 1.1 第一阶段——原位阅读（2026-11-03）

用户已开启持续 goal：按原位阅读、批量整理、自动翻页、画面滤镜顺序推进，计划见 docs/PRO_ROADMAP.md。基线 m0 `2124174`。第一阶段原位阅读已接入原生持久书签、协调只读访问、内容/格式匹配重选、封面刷新与安全清理，默认副本导入免费，已有引用阅读/重选/移除免费；25/25 XCTest、206/206 Vitest、lint、iOS 同步/静态检查及 Debug 编译通过。首轮 URL 属性缓存与测试素材倍率问题已最小修复，未跳过测试。iPhone 18 Pro 简中实测 Pro 入口/本地购买、原位 CBZ 封面/翻页、强退与模拟器重启保留第 2/6 页、误选拒绝与重连恢复、移除引用后原件字节不变，原 5 本/4 系列保留。真机/云盘/第三方提供者、退款后原位交互、大文件性能、本轮独立英文交互未执行；未归档或上传新 TestFlight，构建仍为 7。外部 PRD/计划链接本轮无法读取；下一步批量整理，goal 仍 active。详见 DEVELOPMENT_STATUS.md 顶部。

## 最新：微光漫卷更名与 TestFlight 构建 7（2026-11-03）

用户确认桌面名「微光漫卷」、全名「微光漫卷-离线图片阅读器」，并要求上传构建 7。已同步中文原生显示名、应用内品牌与认证提示、网页标题、Capacitor/安卓中文资源及 README；英文桌面名仍为 LumiComic，Bundle ID/商品 ID/存储键保持原值。四项自动检查通过（203/203 Vitest），19/19 XCTest、Debug 和 Release 归档通过。模拟器主屏实际显示新名称，更新启动后原 5 本漫画及第 2/4 页进度保留。复用本机新发行证书及同一 App 的有效描述文件，签名叶证书核验一致，私钥未导出。App Store Connect 简中全名已保存为用户给定全名；0.0.1(7) 已通过 Xcode Apple ID 上传并完成 Apple 处理，TestFlight 状态「准备提交」，构建 id 238dc11e-8b14-44af-8a5b-ae6bf6d93e94。已补充本次加密类型信息，未送审、未添加测试员；本轮真机及完整交互回归未执行。详见 DEVELOPMENT_STATUS.md 顶部。

## 上一轮：新发行证书与 TestFlight 构建 6（2026-11-03）

本轮从 m0 `52ccd03` 开始。203/203 Vitest、19/19 XCTest（iPhone 17）、Debug/Release 编译通过。修复切换裁边后无法返回书架，四项自动检查重跑通过。iPhone 18 Pro Debug 实测四种格式导入/翻页、Pro ¥20 价格/购买/恢复、裁边预览/效果、隐藏/显示/取消隐藏、退款后数据保留；应用锁冷启动/后台验证、多任务遮挡、取消/重试、阅读第 2/4 页保留及退款后关闭锁均通过。中英文界面及主屏名称已核对，真实设备验收未执行。用户新建本地 Apple Distribution（团队 7R5Z28YJZ9，到期 2027-11-03），补齐官方 WWDR G3 后有效，私钥未导出。工程保留 Automatic，构建号 6、版本 0.0.1；用限定到 App 的手动签名参数归档成功，实际签名证书与下载的新 .cer 逐字节一致。用户明确授权代理通过 Organizer 上传，新证书及「LumiComic AppStore Build 6」描述文件已明确选中。Apple 现已处理完成，网页显示「完成 / 准备提交」，达到 VALID 目标；构建 id 3dd8a6a5-42b8-4e9e-82b7-ac7496e67fb7，创建时间 2026-11-03 08:17。已根据代码与 Apple 说明补充本次加密类型信息，未送审、未主动添加测试员。备案公钥/MD5 仅向用户汇报，不入库；未使用旧 API Key N23VM7F87M。详见 DEVELOPMENT_STATUS.md 顶部。

更新：2026-11-03｜工程：`/Users/alexliao/Documents/weiguang-comic`｜分支：`m0`｜版本：`0.0.1 (6)`

**第六个 TestFlight 构建已上传并完成 Apple 处理：0.0.1 (6)，页面「完成 / 准备提交」，build id `3dd8a6a5-42b8-4e9e-82b7-ac7496e67fb7`。App「微光漫画」app id 6829142764，Bundle ID `dev.weiguang.comic`，Team `7R5Z28YJZ9`。使用新建本地 Apple Distribution，未使用云托管发行证书。真机验收、测试员分配、正式内购创建及送审仍需用户完成。**

## -11. 最新：M3-04 应用锁与隐藏系列（2026-11-02）

- 第二项 Pro 功能完成，1.0 Pro 两项齐备，代码层已开放购买（正式商店显示 Pro 入口）。应用锁：原生 LocalAuthentication + 后台隐私遮挡，失去 Pro/设备关闭密码都不会锁住用户；隐藏系列复用 `series.hidden`。203 个 Vitest 等通过；Swift 与真机未验收，App Store Connect 内购商品需先创建。

## -10. M3-03 自动裁白边（2026-11-02）

- 第一项 Pro 功能：原生确定性裁边（`ContentBounds.swift`）、阅读设置按书开关、未解锁时购买页显示当前页前后对比。195 个 Vitest 等通过；Swift/XCTest 与真实扫描页效果未验收。下一步 M3-04 应用锁与隐藏系列。

## -9. Pro 内购接入与购买页（2026-11-02）

- Pro 定价 ¥20、分组免费、1.0 为裁白边 + 应用锁/隐藏系列（PRD 第 8 节已更新）。StoreKit 2 插件、Pro 状态与策略、购买页和设置入口已接入；两项 Pro 功能交付前正式商店不显示入口。说明见 [docs/PRO.md](./docs/PRO.md)，下一步 M3-03 自动裁白边。
- 193 个 Vitest、lint、构建、iOS 同步与静态检查通过；Swift 未编译，内购未在沙盒验证。

## -8. 应用图标与显示名称（2026-11-02）

- 采用用户提供的翻页漫画图标（源图 `design/app-icon/source-1254.png`），已生成 iOS 1024 与安卓全套启动图标；显示名称简体「微光漫画」、繁体「微光漫畫」、英文「LumiComic」。Xcode 编译与真机显示未验收，启动画面仍为默认。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md)。

## -7. EPUB 验收与 TestFlight 构建 5 上传（2026-11-01）

- XCTest 14/14（含 EpubTests）、Vitest 183、lint/构建/同步/静态检查全通过。
- 模拟器验收：fixed-layout-12p.epub 导入、页序、翻页、自动 RTL 正常；纯文字 EPUB 被拒（「This EPUB is mostly text.」）；ZIP/PDF 回归正常。build `5` VALID。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -6. EPUB（图片漫画）导入与阅读（2026-11-01）

- 正式导入新增 EPUB：原生按 ZIP 读取并只交出 XML/XHTML 文本，网页层 `src/archive/epub.ts` 按 OPF spine 与页面图片引用生成页序、识别右翻、拒绝 DRM 与文字书；图片渲染沿用 ZIP 路径。副本为 `<UUID>.epub`。
- 183 个 Vitest、lint、构建、iOS 同步与 release 静态检查通过；Swift 未编译，新增 2 个 XCTest（共 14 个）未运行，模拟器/真机未验收。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -5. ComicInfo 右翻修复与 TestFlight 构建 4（2026-11-01）

- `ComicStore.inspect` 读根目录 ComicInfo.xml 的 `<Manga>`（YesAndRightToLeft/Yes → manga="rtl"）；`ImportQueue` 据此给新书 `direction='rtl'`（每书偏好，可手动覆盖）。
- 新增 2 个 XCTest + 1 个 Vitest：XCTest 12/12、Vitest 175、lint/构建/同步/静态检查全通过。
- 模拟器复验：含标记 CBZ 自动 RTL（点按区与菜单均右翻），普通 ZIP 仍 LTR、PDF 正常。构建号 3→4 上传，VALID。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -4. 模拟器验收与 TestFlight 构建 3 上传（2026-11-01）

- iPhone 17 模拟器 Debug 构建功能验收：ZIP/CBZ/PDF 导入与阅读、目录跳转、全屏、持久化、旋转全通过，无崩溃。
- 发现（中）：CBZ ComicInfo `<Manga>YesAndRightToLeft</Manga>` 未自动识别为 RTL，需手动切换；已在下一轮修复（见 -5）。
- 构建号 2→3，archive + `-exportArchive` 上传，build `3` VALID。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -3. TestFlight 构建 2 上传（2026-11-01）

- 流程同上：install → build:ios → check:ios --release → SPM 解析 → `xcodebuild -scheme ComicNative test`（10/10 通过）→ archive → `-exportArchive` 上传。
- 一处必要修复：`ios/ComicNative/Package.swift` 目标补 Cordova 依赖，否则独立跑包测试报 `module 'Cordova' not found`；构建号 1→2。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -2. PDF 导入与阅读（2026-11-01）

- 正式导入新增 PDF：iOS 用系统 PDFKit 读取页数并按请求尺寸渲染白底页面（四百万像素上限），副本为 `<UUID>.pdf`；需要密码的 PDF 拒绝导入。网页层按原生页序建页目录，书籍 format 记为 pdf。
- 174 个 Vitest、lint、构建、iOS 同步与 release 静态检查通过；Swift 未编译，新增 2 个 XCTest（共 10 个）未运行，真机未验收。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## -1. TestFlight 上传（2026-10-31）

- `pnpm install --frozen-lockfile` → `pnpm build:ios` → `pnpm check:ios --release` → SPM 解析 → Release 模拟器编译 → `xcodebuild archive` → `-exportArchive` 上传，全链路通过。细节见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。
- 上传前在 App Store Connect 新建 App（用户操作）、API 注册 Bundle ID；构建制品在 `release/`（已忽略，未入库）。

## 0. iOS 代码验收与缺陷修复（2026-10-30，原有记录）

- 修复会导致 Xcode 编译失败的 `prefersHomeIndicatorAutoHidden` 重写冲突（Capacitor 8 SystemBars 扩展为 public 非 open），改由 `childForHomeIndicatorAutoHidden` 接管全屏时的 Home 指示条。
- 修复应用更新/恢复后容器路径变化导致全部书籍无法打开：原生按库目录名 + UUID 文件名在当前容器重新定位副本。
- 网页进程被回收重载后恢复状态栏；状态栏文字随应用主题与阅读背景切换；原生错误补英文；图片禁用长按菜单。
- 全量 171 个 Vitest、构建、iOS 同步与 release 静态检查通过；XCTest 现共 8 个，Swift 未编译、真机未验收。细节与未改风险见 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部检查点。

## 0.1 上一轮：阅读器收尾与提交前检查

- 全屏按钮在浏览器调用 Fullscreen API 并监听退出事件；iOS 新增 ComicReader 的 getDisplayState / setFullscreen 接口，由 WebView 控制器隐藏状态栏、请求自动隐藏 Home 指示条。显示操作串行，下一卷保留会话，返回书架先等待恢复；失败提示可重试。没有新依赖或原生库，安装包增量未测。
- 阅读设置“记住阅读位置”复用 reader.defaults.remember，可选字段默认 true，不动表或 v1/v2。关闭后保留旧进度/时间且仍恢复旧页，停止排队保存和失败重试；进度事务同时读取 settings，旧写入器也不能越过关闭策略。开启后在设置关闭、页面实际显示时恢复记录，书签独立。
- 本轮增加 15 个 Vitest（全屏 7、记住位置 8），全量 20 文件 / 170 用例实际通过；lint 全量通过。构建、iOS 同步、release 隔离、独立原型通过。lint 排除已忽略的发布产物/原型构建/Gradle 缓存，一处旧升级测试仅补格式。
- 隔离真实 IndexedDB＋原生替身核对暂停后进度/最近时间不变、书签仍写、刷新恢复旧页、开启后保存当前页、全屏跨卷与退出/故障重试；另点检实际浏览器全屏接口。375/1280、中英、44px 热区和正式生产空书架无溢出/控制台错误；临时库、验证文件/构建及服务已清理，截图在已忽略的 `release/previews/reader-final-*.jpg`。
- 待 Mac 验收 Swift、6 个 XCTest、系统栏/指示条/旋转与退出手势、原生导入/封面/删除、触屏捏合/滚动、前后台及性能；安卓插件仍未实现。详细边界见 [阅读说明](./docs/READING_M1.md)。

### 第三轮保留（以下测试计数为当轮记录，现已纳入 170 个全量通过）

- 目录来自真实页路径，去公共前缀且不虚构章节；支持章节、原生缩略图和输入页码跳转。48 页分段、可见范围请求、单个目录调度器串行且缓存 24 个结果，关闭跳过等待和迟到结果；预览不推进阅读进度。
- 书签复用现有表，图标/B 键切换、实时列表、删除/重试和准确定位；条漫保存 offset，双页按逻辑首页，书签不用末两页完成锚点。事务防重复/半删，缺书或非法位置拒绝写入，不改阅读进度与时间。
- 适应宽度和 30%–100% 亮度已持久化，亮度只遮罩画面，拖动预览/松手提交；旧设置兼容。修正适宽切条漫的触摸样式覆盖，实际触屏仍待验收。不改表/索引和 v1/v2，无新依赖或原生接口；使用既有 thumbnail 的 400px 原生降采样。
- 新增 22 个 Vitest：目录/外观 7、书签事务 8、缩略图调度 6、外观持久化 1，静态计数 155；按约定未运行 lint / Vitest，6 个 XCTest 未运行。
- `pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 通过。真实隔离 IndexedDB＋原生替身点检目录、失败缩略图、书签故障/页内恢复、刷新与外观；375/桌面、中英、热区/输入字号与正式空书架检查通过，无控制台错误。临时数据与服务已清理，截图为 `release/previews/reader-round3-*.jpg`，详见最新检查点和 [阅读说明](./docs/READING_M1.md)。

### 第二轮保留

- 双页沿用纯逻辑，支持封面单独/拼合、RTL、末尾单张；三张图窗口、原生请求串行。双页两侧都实际显示后才保存，坏页不推进整组。
- 条漫只挂载三张邻近图，原生比例更新和视口变化保持页内位置；progress.offset 持久化。最后两页记末页时清零跨页偏移，避免把倒数第二页偏移用于末页。
- 下一卷从真实同系列、同单位的更大可用编号选最近一卷；切卷等待当前保存并验证目标。保存失败留原卷，重试后切换；返回原书架/系列位置。
- 中央双击、按钮及捏合缩放代码已接，拖动不误翻页、翻页复位，条漫使用纵向滚动。模式、方向、封面、独立背景已能设置并持久化；当前书覆盖值与默认值同事务写入。没有改表/索引、v1/v2 或新增依赖/原生接口。
- 构建/静态检查和隔离真实 IndexedDB 点检已完成，原生使用替身。375/桌面截图保存在 `release/previews/reader-round2-mobile.jpg`、`reader-round2-desktop.jpg`；临时库及验证文件/服务已清理。详见 [阅读说明](./docs/READING_M1.md) 和最新检查点。
- 新增 21 个 Vitest：布局/下一卷/缩放 13、设置与页内进度 7、窗口 1，累计静态计数 133；含倒数第二页位于双页第二侧时的末页锚点回归。按约定未运行 lint / Vitest。6 个 XCTest 未运行，捏合等真实触屏仍待验收。

### 第一轮保留的基础闭环

- 单本、系列卷/当前卷、继续阅读卡片和详情阅读按钮接正式 Reader；返回保留原书架/系列、筛选和滚动位置。书架已有功能见 [SHELF_M1.md](./docs/SHELF_M1.md)，阅读范围见 [READING_M1.md](./docs/READING_M1.md)。
- 复用原生 renderPage、抽取共用 PageLoader，串行加载当前及相邻两页，丢弃过期任务。默认沉浸、点按、首读说明、横滑/键盘/按钮、滑块、基础卷末与重读已接；RTL 读取已有元数据，阅读背景独立。
- 当前图片实际显示且首读说明确认后才保存；末两页记为末页。进度和最近阅读同事务、写入串行，退出等待保存，故障可重试或明确不保存返回；预读、失败页不计进度。详见阅读文档。
- 延续 Dexie v2，不改版本定义；仅增加首读说明 settings 键，没有新增依赖或原生接口。M1-05 的原生缩略图、disposeBook 和副本清理队列保留。
- 第一轮新增 24 个 Vitest，当轮累计 112 个，未执行；第二轮后的当前计数见上文。用户报告的最初 48 个通过是历史基线。
- 第一轮构建通过、隔离数据库点检已完成；当轮未取得截图、前台保护补查曾超时。本轮第二轮已取得截图并核对前台保存；真实前后台、Swift 和真机仍待验。

交互原型保持独立运行，已经确认的界面规格如下：

- 打开方式：`pnpm build:prototype` → `pnpm preview:prototype` → `/prototype.html`；开发用 `pnpm dev:prototype`。入口、功能清单和验证记录见 [UI_PROTOTYPE.md](./docs/UI_PROTOTYPE.md)。
- 已可体验：系列叠放/系列页、用户分组、搜索/筛选/收藏/排序、最多三本继续阅读、管理与导入状态、手机书架/最近/设置底栏；沉浸阅读、点按分区、双页与从右向左、目录/缩略图/书签、卷末和缩放。桌面、720 和 375 宽已点检；颜色与正式 `tokens.css` 共用。
- 实现位置：`src/pages/InteractivePrototype.tsx`、`src/reader/DemoReader.tsx`、`src/app/demo.ts`、`src/components/Demo*.tsx`、`src/styles/demo.css`。演示存储为 `weiguang.interactive-prototype.v1`，不接正式数据库或原生插件。
- `ui-prototype` 构建只输出已忽略的 `prototype-dist/`；正式入口不能 import `demo.ts` 或 Demo 组件，release 检查覆盖原型模块文件名与演示存储键。原型中的样张不进入正式包。
- 下文任务表描述正式 App 进度，不将演示中的界面功能当成正式 M1/M2 完成。接下来的顺序以第 7 节为准。

## 1. 接手方式与项目状态

- 先读 [AGENTS.md](./AGENTS.md)，再看本摘要和 [DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md) 顶部最新检查点。后者保留历次过程，本摘要只描述当前状态。
- 用户已明确允许在没有 Mac 的情况下继续准备界面、存储和纯逻辑代码。旧检查点中的“受阻”指原生编译及验收，不表示所有开发必须停止。
- 始终使用用户选择的主模型与推理强度，单代理执行，不创建子代理、不自动切换模型。
- 本轮开始时 Git `m0` 没有任何提交、工程文件均未跟踪；用户已授权收尾检查后建立首个阶段提交。提交前若缺作者姓名/邮箱，必须向用户取得，不伪造身份。提交状态以 `git log` 为准，保留用户修改，避免重置或清理工作区。
- 前一条开发聊天产生的项目文件均已在本工程内，无须从聊天中另行搬移。
- PRD 与开发计划原文见 [README.md](./README.md)。此前访问 Claude 外链未能读取全文，现有开发依据是历史交接摘录及本地代码；不要声称已读完或重新验证原文。

## 2. 产品与实现约束

只读用户自有文件的本地漫画阅读器，iOS 先行，安卓开发期同步验证、晚一个版本发布，首版不做网页版。

- 不联网、不注册、不追踪、无广告、无 AI；不内置或搜索漫画资源，不支持第三方书源，不处理 DRM，不改用户原文件。安卓不申请网络权限，正式网页 CSP 禁用对外连接。
- 已公开免费的功能不改为付费；Pro 一次买断，购买页仅在用户主动打开时出现。
- 应用标识 `dev.weiguang.comic`；StoreKit 非消耗型商品 `dev.weiguang.comic.pro`。中文名「微光漫画」，英文暂定 LumiComic，最低 iOS 15。
- Pro 价格为国区 ¥20（2026-11-02 确认），其他地区取对应档位，开启家人共享；自定义分组免费。内购代码已接入（docs/PRO.md），App Store Connect 商品待创建。商店素材与备案待发布阶段核对。
- 技术栈为 Vite 8、Preact、TypeScript strict、Signals、Capacitor 8、Dexie。版本以 `package.json` 和锁文件为准。
- 压缩包读取、文件复制、指纹和大图降采样放在原生层；WebView 不加载整个压缩包或原图。文件名解码、排序、系列识别等规则放在 TS 纯逻辑中，并补 Vitest。
- 系统字体、语义 HTML、移动端布局，交互热区不少于 44px；不用 `any` 绕过类型，新依赖须说明用途及体积。

## 3. 各任务目前做到哪里

| 任务               | 已有实现或材料                                                                    | 尚未完成                                                                       |
| ------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| M0-01/02 调研      | 历史交接已整理竞品差评与关键词方向                                                | Apple Search Ads 热度补查                                                      |
| M0-03 测试素材     | 生成脚本、普通素材、真实跨 4 GiB 边界的大包及 CRC 验证记录                        | RAR 素材缺 WinRAR                                                              |
| M0-04 工程初始化   | 网页骨架、iOS/安卓工程、语言与主题；旧安卓调试包已生成                            | 真机打开验证、正式图标                                                         |
| M0-05 iOS 性能原型 | ZIP/ZIP64、ImageIO 降采样、原型导入、翻页/跳页/条漫、邻页调度                     | Swift 编译、XCTest、安装包增量与性能实测                                       |
| M0-06/07           | 安卓工程骨架已有；历史调研条件已有记录                                            | 安卓性能原型、闸门一评审                                                       |
| M1-01 数据库       | Dexie v1→v2 十表、默认设置、高版本保护和升级回滚用例，全量 TS 测试通过            | iOS 持久化与升级验收                                                           |
| M1-02 ZIP 插件     | iOS ZIP 原生代码及正式副本读取已接入                                              | iOS 原生验收、安卓正式插件                                                     |
| M1-03 导入         | iOS ZIP/CBZ 多选、分块复制、进度/取消、原子入库、中断清理                         | 系统分享/“用…打开”、真机导入验收                                               |
| M1-04 整理         | 指纹去重、系列入库、卷/话识别、用户分组持久化及界面                               | 图片文件夹导入及真机验收                                                       |
| M1-05 书架         | 正式系列书架、筛选/管理/导航、原生封面和副本删除接口                              | Swift 编译、XCTest、真实封面/删除与真机验收                                    |
| M1-06～09          | 单页/双页/条漫、原生调度、进度/恢复、下一卷、缩放、目录/书签、外观与全屏/记住位置 | Swift/触屏/性能等 B2 真机验收                                                  |
| M2～M4             | 详细任务号见历史计划                                                              | 双页、缩放、RAR、编码识别、系列、备份、设置、EPUB、Pro、应用锁、性能优化与发布 |

M1 的部分代码是提前准备，不能把这些进展写成闸门一已通过或 M1 已验收。

## 4. 本轮正式导入的行为与边界

`系统多选 ZIP/CBZ → 作业入库 → 原生复制 → 指纹/目录检查 → TS 过滤和排序 → 识别系列与卷/话 → 原子保存系列、书籍、页目录、完成状态 → 书架更新`

- `ComicImport` 返回的 `uri` 是当前原生进程持有的临时标识，网页不能借此传入任意外部路径；复制每次至多读取 1 MiB。
- 正式副本位于 Application Support / `ComicLibrary/`，先写 UUID `.part`，完成后改名为 `.zip`；目录和文件排除整机备份。用户源文件只读。
- 原型副本仍在 `ComicPrototype/`；原型重置只清理原型目录。`ComicArchive` 能读取这两种应用副本。
- 加密包、无可读图片或无效复制结果显示失败；单个文件失败后继续后续文件。相同指纹跳过并清理本次多余副本，不删除已有书籍。
- 复制及检查阶段可取消；进入原子保存阶段后不再取消。迟到或倒退的复制进度不会串到另一项作业。
- 重开时保留已入库副本，清理未完成副本并提示重新选择；清理失败保留 `cleanupPending`，下次打开重试。当前没有字节级续传或跨进程自动恢复外部文件授权。
- 正式界面已接基础阅读器，单本、卷和继续阅读可直接阅读，管理按钮仍开详情。缺少原生插件时导入及副本删除禁用，阅读器明确提示需在移动端加载；桌面和安卓目前均无正式原生插件。

## 5. 接着修改时优先看这些文件

| 位置                                                                           | 职责                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `src/app/LibraryApp.tsx`、`src/app/library.ts`                                 | 打开数据库、恢复导入、选择文件与应用状态             |
| `src/library/ImportQueue.ts`、同名测试                                         | 串行作业、取消、去重、事务提交与失败清理             |
| `src/native/comicImport.ts`                                                    | 正式原生导入接口与可用性判断                         |
| `src/native/comicArchive.ts`                                                   | 压缩包接口、原生页面地址转换                         |
| `src/db/models.ts`、`schema.ts`、`migrations/v2.ts`、`index.ts`                | 数据模型、十表定义、旧库升级与数据库打开入口         |
| `src/library/series.ts`、`seriesRecord.ts`、`seriesRepository.ts`、`groups.ts` | 识别规则、系列入库及分组持久化                       |
| `src/pages/Shelf.tsx`、`src/components/ImportStatus.tsx`                       | 书架结果和导入状态界面                               |
| `src/archive/pageList.ts`                                                      | 文件名解码、图片过滤与数字自然排序                   |
| `src/pages/Prototype.tsx`、`src/reader/`                                       | M0 阅读原型、页调度及视口定位逻辑                    |
| `ios/ComicNative/Sources/ComicNative/ComicImportPlugin.swift`                  | 系统多选、复制、取消、授权释放与副本清理             |
| 同目录 `ComicArchivePlugin.swift`、`ComicStore.swift`、`ZipDirectory.swift`    | 串行归档操作、降采样/缓存、ZIP/ZIP64 中央目录        |
| `ios/App/App/ComicBridgeViewController.swift`                                  | 注册正式插件，原型插件只在 `DEBUG` 下注册            |
| `ios/App/App/Info.plist`、`AppDelegate.swift`、`SceneDelegate.swift`           | 下一步系统文件交接入口涉及的位置                     |
| `scripts/check-ios.mjs`                                                        | 工程连接、插件注册、隐私、离线配置与原型隔离静态检查 |
| `docs/IOS_B1.md`、`docs/IMPORT_M1.md`                                          | 原型性能和正式导入的 Mac 操作与验收步骤              |

接口以当前 TS/Swift 源码为准。历史草案中的 `pickFolder`、`incoming`、`contentBounds`、应用锁等不代表已经实现；当前 `crop: true` 仍拒绝执行，裁白边留待 M3。

数据库名 `weiguang-comic`，当前 v2 在 v1 八表上增加 `libraryGroups` 和 `fileCleanup`；后者已用于持久化原生副本清理任务。只存元数据；后续结构升级新增版本，禁止改写旧版本定义或删库重建。

书架入口在 `src/pages/Shelf.tsx`；订阅在 `src/app/useShelf.ts`，纯视图规则在 `src/library/shelf.ts`，标记与删除事务在 `actions.ts`，原生重试在 `FileCleanupQueue.ts`。组件、接口和验收步骤详见 `docs/SHELF_M1.md`。

跨端指纹协议按原生现有实现：`sha256(十进制文件字节数 + LF + 前 1 MiB + 后 1 MiB)`。安卓实现必须保持一致。页面缓存上限 500 MiB；当前 iOS 原型单页降采样限制约 400 万像素，长条漫清晰度与内存仍待实测。

## 6. 已验证与未验证

以下是阅读器收尾及提交前检查结果，详情见 `DEVELOPMENT_STATUS.md` 顶部检查点。

| 层级        | 结果与实际含义                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 自动构建    | `pnpm build`、`pnpm build:ios`、`pnpm build:prototype` 通过；含 TS strict、Web 构建与 iOS 资源同步，不包含 Swift/Gradle 编译 |
| 静态检查    | `pnpm check:ios --release` 通过；正式包排除原型入口、模块文件名及演示存储键；v1 定义 SHA256 与修改前一致                     |
| 浏览器数据  | 本轮隔离 IndexedDB 点检记住位置暂停/恢复/刷新、书签、跨卷全屏/退出恢复/失败重试；前三轮验证保留。原生替身，数据已清理        |
| 正式界面    | 阅读器 375×812 / 1280×900 截图与 DOM/按钮 44px 检查，中英控制台无错误；生产空书架桌面/375 无横向溢出                         |
| lint/Vitest | 全量 `pnpm lint` 通过；20 个文件 / 170 个 Vitest 通过，含本轮新增 15 个及此前全部用例                                        |
| 原生与真机  | Swift、8 个 XCTest、全屏系统栏/指示条、真实封面/删除/导入、iOS 升级/持久化、性能、捏合、iPad、安装包增量均未验收             |

历史导入截图：`release/qa/import-ui-check-20261030.png`（已忽略，与本轮阅读器无关）。

本轮没有新增依赖。累计已有 Dexie `4.4.6`、测试专用 fake-indexeddb `6.2.5`、iOS ZIPFoundation `0.9.20`；libarchive 尚未接入。

旧安卓 APK 为 `android/app/build/outputs/apk/debug/app-debug.apk`，生成于 2026-10-29，4,134,325 字节；它不包含本轮正式导入更新，也未做真机验收。本轮没有新 APK/IPA。

## 7. 下一步

1. 收尾代码和提交前全量检查已完成；阶段标题 `M1-09: 正式书架与阅读器阶段收尾`，首次提交包含 197 个工程/文档文件，作者已由用户提供。目录/缩略图/书签、适宽/亮度、全屏/记住位置不再重复开发；范围与边界见 `docs/READING_M1.md`。
2. 继续补系统分享/“用…打开”、图片文件夹导入等缺口；保持独立原型与正式资源隔离。
3. 在 Mac 补 Swift、XCTest、真实触屏捏合/滚动、原生缩略图/缓存和大目录内存、iPad/旋转、前后台/强杀验收。没有这些实测就不能通过 B1/B2。
4. 安卓 M0-06/正式原生插件仍未实现，不能因为阅读器网页完成而记作安卓可读；继续保持原型独立和正式资源隔离。
5. 每轮跑 `pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`，浏览器检查正式界面 375 和桌面；lint / 全量 Vitest 留到闸门和提交前。分开记录代码、自动检查与真机结果，并更新检查点。

Mac 可用时并行完成 B1。现有 iOS 工程已经生成，复制完整工程到 Mac 后安装依赖即可，**不要再执行 `cap add ios`**；按 [IOS_B1.md](./docs/IOS_B1.md) 编译、运行 XCTest 并测性能。

闸门一需有 iOS 性能数据：基准为 iPhone 12 / iPad 第9代，首图不超过1秒、预读页切换不超过100ms、条漫60fps、App与WebContent合计峰值内存不超过400MB；完整指标见 B1。闸门二还需全部 P0 真机验收及性能达标。

## 8. 常用命令与素材

```powershell
pnpm build:ios
pnpm check:ios --release
pnpm exec vite preview --host 127.0.0.1 --port 4176 --strictPort
```

这组命令用于正式网页预览；`pnpm dev` 当前会进入 M0 原型。原型使用 `pnpm build:ios:prototype`，完成原型检查后重新运行 `pnpm build:ios`，以免下一次启动误用原型资源。预览服务在前台运行，结束后关闭；本轮创建的临时预览服务已停止。

- `pnpm build:android` 只做类型检查、网页构建及安卓资源同步，不生成 APK。
- `pnpm lint`、`pnpm test` 平时默认不跑；闸门一、闸门二、提交审核前各统一运行全部 Vitest。
- `pnpm test-books` 生成普通素材；大包命令 `python scripts/make_test_books.py test-books --big`。现有大包无需重复生成：`test-books/big-4gb-2000p.zip` 为5,264,533,542字节（4.903 GiB），含2000张图片，所有图片偏移跨过4 GiB；素材 CRC/抽样解码记录见 `test-books/ZIP64_VERIFICATION.json`。这只证明素材完整，不证明原生性能达标。
- 安卓构建沿用项目独立的 `.gradle-home/`，全局 Gradle 缓存此前损坏；SDK 在 `D:/Android/Sdk`，JDK 21 在 `D:/Android/jdk/jdk-21.0.12.1+1`。
- 不提交 `node_modules`、`dist`、测试素材、构建产物、签名材料、私钥或真实用户漫画。

旧版接口草案、完整 M0～M4 任务号、历史估时及可复用微光阅读代码位置，保留在 [历史交接明细](./docs/history/CODEX_HANDOFF_2026-10-30_before-summary.md)。它包含已经过时的状态描述，仅作追溯，不用于判断当前完成情况。
