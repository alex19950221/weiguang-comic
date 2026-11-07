# 开发进度检查点

## 最新检查点：阅读背景改为中性纯白/纯黑（2026-11-07）

- 起因：用户真机截图（彩色漫画白底页）显示默认「暖纸」#E7E7DD 底色在白色页面四周形成米黄灰色块，衔接突兀。参照 Apple Books、Panels、Chunky、Mihon 等阅读器均使用无色相的纯白/纯黑底（Mihon 另有按页边取色的自动模式）。
- 代码：阅读背景选项改为「自动 / 纯白 / 纯黑」。存储值仍为 `system / white / black`，不改数据库；`system` 由暖纸改为自动：书架外观解析为深色（含跟随系统）时纯黑 #000000，否则纯白 #FFFFFF，切换系统深浅色时实时跟随，状态栏文字同步（新增 `src/reader/useAppDark.ts`）。纯黑由偏绿 #222722 改为 #000000；阅读器文字色改中性（对比度 16.83:1 / 17.12:1）；亮度遮罩由偏绿 #151b14 改为纯黑。书架界面配色未改。
- 自动检查（实际执行，通过）：`pnpm lint`、`pnpm test`（31 文件 233/233）、`pnpm build:ios`、`pnpm check:ios --release`；App Debug 本地签名模拟器构建 BUILD SUCCEEDED。日志 `release/qa/bg-*.log`。
- 模拟器（实际执行，iPhone 18 Pro）：覆盖安装后打开 QA Borders 第 2/4 页，浅色为纯白底、白边页面与背景融为一体；阅读中切系统深色，背景即时变纯黑、状态栏文字变白；阅读设置显示「自动 / 纯白 / 纯黑」且默认选中自动。之后恢复浅色外观，书架数据保留。
- 未执行：真机、英文界面目视（仅词条更新 Auto/White/Black）、按页边取色的自动底色（可作后续）、新构建上传。

## 最新检查点：TestFlight 1.0.0（10）归档与上传（2026-11-05）

- 来源与范围：用户根据最新进度截图要求上传 TestFlight，并提醒本地代码已同步。重新核对本地与 `origin/m0` 都为 `9234fe5`、工作区干净；版本已为 **1.0.0（10）**，本轮未修改产品代码或再递增构建号。沿用本 App 已核验的新发行证书；未访问或推送错误的 weiguang-reader 仓库。
- 自动检查（本轮实际执行，通过）：Node 24.22.2 / pnpm 11.21.0；`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`（31 文件 **233/233**）、`pnpm build:ios`、`pnpm check:ios --release`、`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App`。日志 `release/qa/build10-{install,lint,vitest,web,static,resolve}.log`。未跳过、删除或禁用测试。
- XCTest 与 Debug（本轮实际执行，通过）：在 `ios/ComicNative`，`xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=75C111D7-B54C-4B57-AB0C-275B4B1F5994' -derivedDataPath <repo>/release/native-derived -resultBundlePath <repo>/release/qa/build10-native.xcresult test` 完整 **32/32，0 失败**。App 使用 `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build`，**BUILD SUCCEEDED**。日志 `build10-{native,debug}.log`；未把编译记为交互验收。
- Release 归档（成功）：`xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath release/LumiComic-build10.xcarchive -derivedDataPath release/archive-derived-build10 CODE_SIGN_STYLE=Manual 'CODE_SIGN_IDENTITY=Apple Distribution: Zhiliang Liao (7R5Z28YJZ9)' 'PROVISIONING_PROFILE_SPECIFIER=$(LUMICOMIC_PROFILE_$(PRODUCT_NAME))' 'LUMICOMIC_PROFILE_App=LumiComic AppStore Build 6' DEVELOPMENT_TEAM=7R5Z28YJZ9 archive`，**ARCHIVE SUCCEEDED**，工程保留 Automatic。日志 `build10-archive.log`。既有 ZIPFoundation 废弃初始化器/多余 try、无 AppIntents 元数据警告保留，无编译失败。
- 成品核验（通过）：codesign 深度严格验证成功；实际版本 1.0.0(10)、Bundle ID `dev.weiguang.comic`、团队 7R5Z28YJZ9 正确。实际公开叶证书与构建 9 新发行证书逐字节一致，类型为本机 **Apple Distribution**，到期 **2027-11-03（UTC+8）**，私钥未导出。描述文件「LumiComic AppStore Build 6」有效且仅绑定同一证书、get-task-allow=false、无设备列表；dSYM 齐备、无 .storekit 测试配置。三档 LaunchIcon 的 120/240/360 像素尺寸正确；8 个网页资源与同步后的源文件逐个 SHA-256 一致，包含内置隐私政策；简繁桌面名微光漫卷、英文 LumiComic；`ITSAppUsesNonExemptEncryption` 为布尔 false。结果 `release/qa/build10-verification.json`。
- 环境与核验修正：初始 shell 没有 Node 路径，使用已安装的 `~/Library/Developer/WeiguangTools/node-v24.22.2-darwin-arm64/bin` 后恢复；模拟器查询与公开描述文件解码首次受沙箱/系统服务权限限制，允许后成功。制品核验初稿错误地要求启动 PNG 与源文件字节相等，而 Xcode `copypng -compress` 会生成 CgBI PNG；核实归档日志后改为检查三档文件、PNG 格式及尺寸，未修改产品或单元测试。外部 PRD/开发计划链接本轮仍无法读取，不宣称获取原文。
- 上传：已执行 `xcodebuild -exportArchive -archivePath release/LumiComic-build10.xcarchive -exportOptionsPlist release/qa/build10-ExportOptions.plist -exportPath release/build10-upload -allowProvisioningUpdates`，使用 Xcode Apple ID、本机手动发行签名，保留版本/构建号并上传符号；未使用旧 API Key。**2026-11-05 23:05:41（UTC+8）Upload succeeded / EXPORT SUCCEEDED**，退出 0；Xcode 显示 uploaded package is processing，上传已成功，Apple 已开始处理。日志 `build10-upload.log`。
- Apple 处理与后续：刷新 App Store Connect 时网页登录已过期，已请用户重新登录，当前尚未恢复。最终处理完成/VALID、出口合规自动识别和测试群组状态**未核验**，不把 Xcode 的上传成功当作 Apple 处理完成。未提交正式审核、未添加测试群组或测试员；商店侧材料仍由用户操作。
- 模拟器交互：本轮未重复完整功能点检；相同产品代码在下方检查点已核对浅/深色启动图、中英隐私政策、原 5 本/4 系列与 QA Borders 第 2/4 页保留。未执行：真实设备、真实/沙盒购买恢复/退款、性能/内存/耗电、iPad 完整回归、安卓、正式 App Review。所有制品、签名材料和日志仅在已忽略的 release 下，不入库。

## 最新检查点：送审前代码补齐 1.0.0（10）（2026-11-05）

- 范围：用户在送审评估后要求先修代码，其余商店侧（内购商品、备案、截图、隐私网址、年龄分级、审核备注）由用户操作。基线 m0 `a3e7ddb`（与远端一致），单代理执行；未归档、未上传、未提交。
- 隐私政策：新增 `src/app/privacyPolicy.ts`（中英同结构）与设置页「隐私政策 / 查看」弹窗 `PrivacyDialog`，全文内置（正式包禁止外链，离线可看），满足审核 5.1.1(i) 的 App 内入口要求。`docs/PRIVACY_POLICY.md` 为同文托管版，`privacyPolicy.test.ts` 校验中英结构一致且托管版逐段包含 App 内文本。联系方式写为「App Store 产品页的 App 支持链接」，未写入个人邮箱或姓名。
- 启动画面：原 Capacitor 模板蓝色 X 图（2732² 整屏图）实际从未显示——模拟器 SplashBoard 日志 `Estimated size (29900800) is over limit (25000000)`，启动图超系统 25 MB 渲染上限而黑屏；旧图 A/B 复现同样黑屏。改为 LaunchScreen 系统背景色（浅白/深黑随系统）+ 居中 120pt 圆角 App 图标，图标为散装 `LaunchIcon.png/@2x/@3x`（工程资源已登记），删除 Splash.imageset。另实测资源目录中的图片与命名颜色在模拟器生成启动图时读取失败（`Could not load the "LaunchIcon" image`、`CUIThemeStore: No theme registered`，Xcode 本地签名、未瘦身构建与 UILaunchScreen 写法均同样失败），散装 PNG 正常，因此不用资源目录；真机是否同样受限未验证。注意：`CODE_SIGNING_ALLOWED=NO` 的模拟器构建会因签名校验（-67056）一律显示黑色启动画面，核对启动画面需用 `CODE_SIGN_IDENTITY=-` 本地签名构建。
- 版本与出口合规：营销版本 0.0.1→**1.0.0**、构建号 9→**10**（Debug/Release），package.json 同步 1.0.0；Info.plist 增加 `ITSAppUsesNonExemptEncryption = NO`（与此前各构建在网页选择的「不属于上述任意一种算法」一致），之后上传不再逐个构建询问。
- 小修：手机宽度下长弹窗最大高度扣除安全区，隐私政策/Pro 弹窗不再顶到状态栏与灵动岛。README 首段格式描述改为实际支持的 ZIP/CBZ/PDF/图片 EPUB 并链接隐私政策。
- 自动检查（实际执行，通过）：`pnpm lint`、`pnpm test`（31 文件 **233/233**，新增 2）、`pnpm build:ios`、`pnpm check:ios --release`；App Debug 模拟器构建与 Release `generic/platform=iOS` 无签名构建均 **BUILD SUCCEEDED**，Release 产物为 1.0.0(10)、加密键 false、含三张 LaunchIcon、Assets.car 仅剩 AppIcon。日志 `release/qa/v1-*.log`。Swift 未改，本轮未重跑 XCTest。
- 模拟器验收（实际执行）：iPhone 18 Pro Max（临时，用后卸载、恢复中文与浅色并关机）本地签名构建暂停启动截图：浅色 #FFFFFF、深色 #000000 底，中心为图标，SplashBoard 无错误；中英文设置页「隐私政策」行与弹窗全文、滚动、关闭正常。QA 用 iPhone 18 Pro 覆盖安装 1.0.0(10)，启动画面正常、原 5 本/4 系列与 QA Borders 第 2/4 页保留。另在 iPad Pro 13 寸模拟器装构建 9 点检书架侧栏布局正常（用后卸载并关机）。
- 观察未改：英文设置页「外观」下拉在窄屏显示为「Syst」被截断；WebView 首次加载前的空白底色未随深色模式（冷启动约 1–数秒）。
- 未执行：真机、沙盒内购、iPad 完整流程、Release 签名归档与 TestFlight 上传（构建 10 待用户归档上传）、App Store Connect 任何操作。

## 最新检查点：TestFlight 构建 9（2026-11-05）

- 用户明确要求将最新验收版本上传 TestFlight。m0 从 `a081e0c` 快进至已推送的 `ce6c79c`，包含 `5987907` 六项网页 QA 修复及本机原生导入卷序补修和验收记录，无冲突；工作区开始时干净。
- 代码：App Debug/Release 构建号 8→9，版本仍为 0.0.1。工程保留 Automatic、团队 7R5Z28YJZ9；实际复用已核验的本机 Apple Distribution 和同 App 有效描述文件「LumiComic AppStore Build 6」，命令行限定 App 手动签名，私钥只在本机钥匙串。
- 自动检查（本轮实际执行，通过）：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`（30 文件 **231/231**）、`pnpm build:ios`、`pnpm check:ios --release`、`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App`。日志 `release/qa/build9-{install,lint,vitest,web,static,resolve}.log`。
- XCTest 与 Debug（本轮实际执行，通过）：在 ios/ComicNative，`xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=75C111D7-B54C-4B57-AB0C-275B4B1F5994' -derivedDataPath <repo>/release/native-derived -resultBundlePath <repo>/release/qa/build9-native.xcresult test` 完整 **32/32，0 失败**；App Debug 以 iPhone 18 Pro、`-derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` 显示 **BUILD SUCCEEDED**，日志 `build9-{native,debug}.log`。未跳过、删除或禁用测试，无编译/测试失败。
- Release 归档（成功）：`xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath release/LumiComic-build9.xcarchive ... archive`，追加 `CODE_SIGN_STYLE=Manual`、本机 Apple Distribution 身份、`PROVISIONING_PROFILE_SPECIFIER='$(LUMICOMIC_PROFILE_$(PRODUCT_NAME))'`、`LUMICOMIC_PROFILE_App='LumiComic AppStore Build 6'`、团队 7R5Z28YJZ9，**ARCHIVE SUCCEEDED**。工程仍保留 Automatic，日志 `build9-archive.log`。既有 ZIPFoundation 废弃初始化器、无 AppIntents 元数据提示为编译警告，没有为发布进行无关修改。
- 签名与制品核验（通过）：codesign 深度严格验证成功，实际 **0.0.1(9)**、Bundle ID/团队正确；公开叶证书与构建 8 所用的新本机证书逐字节一致，类型 Apple Distribution，到期 **2027-11-03（UTC+8）**。内嵌发行描述文件只绑定该证书、get-task-allow=false、无设备列表；dSYM 存在、无 .storekit 测试文件；简繁桌面名「微光漫卷」、英文 LumiComic。结果 `release/qa/build9-verification.json`。首次公开证书提取命令把可选前缀写为空格参数，工具报路径不存在；改为 `--extract-certificates=<prefix>` 后全部核验通过，与编译或签名失败无关。未导出私钥。
- 上传（成功）：`xcodebuild -exportArchive -archivePath release/LumiComic-build9.xcarchive -exportOptionsPlist release/qa/build9-ExportOptions.plist -exportPath release/build9-upload -allowProvisioningUpdates`，**2026-11-05 12:15:08（UTC+8）Upload succeeded / EXPORT SUCCEEDED**，退出 0。使用 Xcode 已登录 Apple ID，沿用手动发行签名并保留构建号、上传符号，未使用旧 API Key N23VM7F87M；日志 `build9-upload.log`。日志/配置/签名材料/制品均在已忽略的 release 下，不入库。
- Apple 处理（已完成）：用户恢复右侧网页登录后核验 0.0.1(9)，构建 id `f41808a0-3a7b-4c65-bc68-9b51a6506cc6`，初始上传区显示「正在处理」，创建 Nov 5, 2026 12:15 PM。处理后提示缺少出口合规信息；核对本轮未新增自有加密实现，结合 [Apple 说明](https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation)，拟沿用构建 8 答案。自动审批要求对具体声明另行确认，用户明确授权「允许选择并保存」后，选择「不属于上述的任意一种算法」并保存。最终 TestFlight 显示 **准备提交、90 天后过期**，上传日期 **2026-11-05 12:16（UTC+8）**，以网页状态核验达到 VALID 目标，未调用 API 读取原始 processingState。截图 `release/qa/build9-appstore-complete.png`；未提交 App Review、未主动添加群组或测试员，群组仍待分配。
- 模拟器验收：发布前已对同一产品代码执行六项 QA 与四格式点检及最小补修，详情为下方 2026-11-05 检查点。本轮仅增加构建号，未重复完整功能点检。未执行：真机、真实内购/退款、性能/内存/耗电、安卓、正式 App Review；不把构建与单元测试记为真机通过。
- 提交范围：最新验收代码快进 m0 后，仅提交构建号、本文、CODEX_HANDOFF 与路线图的发布摘要；使用用户指定的单次提交身份，全局 Git 身份未改。构建产物、公有证书、描述文件及所有签名材料均不入库。

## 最新检查点：模拟器验收与原生导入卷序补修（2026-11-05）

- 范围与代码来源：用户最初要求拉取最新代码并真机验收。Mac 解锁后，`xcrun devicectl --timeout 20 list devices` 与 Device Hub 均只识别到模拟器，用户明确改为「先做模拟器验收」。原工作区 `m0` / `a081e0c` 干净，`git pull --ff-only origin m0` 已是最新；`git fetch origin` 定位到截图对应的 `origin/claude/sharp-allen-0xoaaj` / `5987907`。在独立 worktree `weiguang-comic-device-qa-20261105`、分支 `codex/device-qa-20261105` 检出验收，未合并 m0。已读 AGENTS、交接、本文与 iOS/Pro 文档，单代理执行；外部 PRD/开发计划原文仍未获取，不宣称读过。
- 代码实现与发现的问题：六项网页修复接入真实 iOS 桥后，实际先点第 01 卷、再点第 02 卷，同批记录仍显示 02→01。网页 sequence 保留输入顺序，但原生选择回调的 URL 顺序与点击/文件名顺序不同。最小补修：`ComicImportSelection.ordered` 在原生回调中按文件名自然排序（数字、忽略大小写、固定 locale、等价名称稳定兜底），再生成来源 token；网页继续保留来源顺序，历史记录不重排，不承诺保留系统选择器点击先后。新增 2 个 XCTest 覆盖逆序多卷、2/3/10 数字顺序、等价名称稳定性、不丢选中项与空集合。无新依赖、无数据库升级、未改签名/构建号，仍为 **0.0.1(8)**。
- 自动检查（实际执行，通过）：Node 24.22.2 / pnpm 11.21.0；`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`（30 文件 **231/231**）、`pnpm build:ios`、`pnpm check:ios --release`。补修后重新执行后四项全部通过；日志 `release/qa/qa-20261105-final-{lint,vitest,web,static}.log`，首次日志为不带 final 的同名文件。没有跳过、删除或禁用测试，本轮无自动测试/编译失败。
- XCTest（实际执行，通过）：先在 iPhone 18 Pro / iOS 27.2 执行完整 ComicNative 包测试 **30/30**；补修后在专用 iPhone SE (3rd generation) / iOS 27.2 执行完整包测试 **32/32，0 失败**。最终命令在 `ios/ComicNative`：`xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=75C111D7-B54C-4B57-AB0C-275B4B1F5994' -derivedDataPath <worktree>/release/native-derived -resultBundlePath <worktree>/release/qa/qa-20261105-final-native.xcresult test`；日志 `qa-20261105-final-native.log`。
- App 编译（实际执行，通过）：补修后 `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` 显示 **BUILD SUCCEEDED**；另以 `-destination 'generic/platform=iOS' -derivedDataPath release/device-derived CODE_SIGNING_ALLOWED=NO build` 真机 SDK 编译成功。日志 `qa-20261105-final-{debug,device-build}.log`。后者不签名、不安装，不能记为真机功能验收。
- 模拟器应用锁（实际执行）：iPhone 18 Pro / Debug 更新安装保留既有书架与 Pro。界面切英文后，原生系统认证页实际显示 **Turn on app lock**，未输入/设置任何模拟器密码，取消后仍关闭。Xcode Face ID 菜单禁用，沿用用户已对同一 UUID 明确授权的 notifyutil enrollmentChanged=1、pearl.match / pearl.nomatch 测试操作，走通开启、后台隐私遮挡、返回要求认证、失败后取消停在英文锁屏、重试匹配解锁、关闭锁。最终恢复关闭与跟随系统语言。**Unlock LumiComic** 翻译由 Vitest 覆盖，本轮 Face ID HUD 未显示自定义说明，未冒称目视核验此行。截图 `qa-20261105-lock-enable-en.png`。
- 模拟器小屏与空状态（实际执行，通过）：新建本轮专用 `Weiguang QA Compact 20261105`（iPhone SE 3，375 CSS px），空书架中文/英文「最近」分别显示「这里还没有漫画 / 打开一本漫画后会显示在这里。」与 **Nothing here yet / Comics you open will appear here.**，无误导的清除筛选提示；「开启 / Turn on」保持单行。中英文 Pro 页面列完六项已交付功能后直接到恢复/购买与说明，没有空的后续更新标题。英文免费页价格实际显示 $2.99，未点击购买。大屏补查有 REVIEW 搜索而无匹配时仍显示原「没有找到漫画 / 试试其他关键词或筛选条件 / 清除筛选」，清除后返回书架。截图 `qa-20261105-{recent-375-en,settings-375-en,pro-375-en}.png`，专用空书架模拟器保留英文供复看。
- 模拟器导入与单卷删除（实际执行，通过）：仅使用本机自绘 QA Review 素材。ZIP 第 01 卷 + CBZ 第 02 卷同批导入并归入一个系列；补修后故意逆序点击 02→01，再次导入的最新记录稳定显示 01→02，重复安全跳过，旧批记录保留在其后。系列内第 2 卷删除确认实际写明「QA Review Series 第 2 卷」，取消后书目保留。英文单卷删除提示本轮未独立操作，纯逻辑回归用例通过。截图 `qa-20261105-import-order-{before,after}.png`、`qa-20261105-delete-volume-zh.png`。
- 模拟器四格式与清理（实际执行，通过）：自绘 ZIP/CBZ 副本、PDF（3 页）/图片 EPUB（4 页）原位导入，四种均打开首图并实际翻到第二页，原位 EPUB 显示第 2/4 页。仅在 REVIEW 搜索范围移除本轮 3 系列/4 本临时书，副本目录 **7→5**、引用 **2→0**，四份原件完整 SHA-256 与生成后记录一致。最终原 **5 本/4 系列**、QA Borders 第 **2/4 页** 保留，跟随系统语言、网格布局、应用锁关闭；两条本轮重复跳过记录留在历史中，未清除原导入历史。核对结果 `release/qa/qa-20261105-cleanup-verification.json`，截图 `qa-20261105-epub-inplace-page2.png`。
- 失败与环境边界：本轮发现的产品问题为上方原生多选卷序，补修并复验通过，没有删测试放行。首次设备查询受 Xcode 系统缓存访问权限限制，允许后成功；Mac 曾锁定、Face ID 菜单不可用均按实际环境记录，不记为产品测试失败。下方云端 QA 的四项观察仍保留，未进行无关修改。
- 未执行：真实 iPhone 安装/交互、真实 Face ID/设备密码、真机重启/文件授权、iCloud/第三方提供者、真实/沙盒 StoreKit 购买恢复/退款/家人共享、全套历史 Pro 组合回归、性能/内存/耗电、安卓、本轮 Release 归档与新 TestFlight 上传。没有把模拟器、SDK 编译、单元测试写成真机通过。日志/截图/素材/制品均只在已忽略的 release 下，不入库；提交仅含最小排序修复、2 个 XCTest、注释及两份交接记录。

## 最新检查点：网页层验收修复（2026-11-05）

- 用户要求读取最新代码并对当前产品做验收修复。基线 `a081e0c`（与 m0 一致），开发分支 `claude/sharp-allen-0xoaaj`，开始时工作区干净。本轮在 Linux 云端容器执行，**没有 Mac/Xcode/模拟器/真机**，单代理执行，未改动 Swift、构建号或签名材料。
- 基线自动检查（实际执行）：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`（29 文件 227/227）、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 全部通过。
- 验收方式（实际执行）：通读 src/app、library、reader、components、db、native 网页层；对生产构建（含离线 CSP）用 Chromium + Playwright 注入 iOS 桥替身（只在 scratchpad，不入库），模拟 ComicImport/ComicArchive/ComicReader/ProStore/ComicLock 的返回。点检中英文、390/375/1280 宽：副本/原位导入、重复与不支持格式、系列页、单页/双页 RTL/条漫、目录、卷末与下一卷、坏页与原位重选（错选被拒、正确恢复）、裁白边购买页预览与购买后生效、滤镜参数透传、自动翻页（2 秒间隔翻到卷末停止并释放常亮）、批量标读完、隐藏系列、新建分组、应用锁开启、删除与原生清理参数。全程无控制台错误、无横向溢出、交互热区不小于 44px。
- 发现并修复：
  1. 应用锁系统验证弹窗说明固定传中文（英文界面也显示「开启应用锁」「解锁微光漫卷」）→ 调用时按界面语言翻译，补英文 `Turn on app lock` / `Unlock LumiComic`。
  2. 同一次多选导入的「导入记录」顺序随机（同批 createdAt 相同、按随机主键排列，第 02 卷排在第 01 卷前）→ 任务新增可选 `sequence`（不建索引、无数据库升级），新批在前、同批按选择顺序。
  3. 系列内删除单卷的确认只写系列名「从书架删除《海边小镇》？」，容易误以为删除整个系列 → 写明「海边小镇 第 2 卷」；整个系列与单本仍只写书名。
  4. 设置页手机宽度下「应用锁」按钮被说明文字挤成两行（「开/启」）→ 设置行按钮不收缩、不换行。
  5. 「最近阅读」为空（或无任何筛选的空范围）时显示「没有找到漫画 / 试试其他关键词或筛选条件 / 清除筛选」→ 无筛选时显示「这里还没有漫画」，最近页补「打开一本漫画后会显示在这里。」；有搜索/筛选时保持原提示。
  6. 六项 Pro 均已交付后，购买页仍显示空的「后续更新，买断用户免费获得」标题 → 仅在有未交付功能时显示；开头说明已承诺后续更新免费。docs/PRO.md 同步。
- 修复后自动检查（实际执行）：`pnpm lint`、`pnpm test`（30 文件 **231/231**，新增 4：验证说明跟随语言、导入记录顺序、删除单卷标题 2 例；前两项已确认在旧代码上失败）、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 全部通过。浏览器复验上述 6 项均符合预期，中英文无控制台错误。无新依赖、无数据库版本变化、无 Swift 改动。
- 观察但未改（记录供后续决定）：原位书删除确认沿用「App 内副本…会一并清除」文案（无副本，原件不受影响，无数据风险）；阅读器 375 宽英文顶栏副标题会折成两行；坏页上重选原件后回到最后一次实际显示的页（符合“只记录实际显示页面”规则）；README 首段仍写 RAR/图片文件夹导入，正式导入目前只支持 ZIP/CBZ/PDF/EPUB。
- 未执行：Swift 编译、XCTest、模拟器与真机交互、真实 StoreKit/面容 ID、性能与内存、安卓。浏览器替身只验证网页层逻辑与界面，不能替代原生或真机验收；本轮未归档、未上传 TestFlight（仍为 0.0.1 (8)）。

## 最新检查点：TestFlight 构建 8（2026-11-03）

- 用户要求打包并上传构建 8，基线 m0 `aa7655e`，工作区干净，远端无分歧。重新阅读工程规范与交接；App Debug/Release 构建号 7→8，营销版本仍 0.0.1，包含已完成的四项 Pro 后续功能。工程签名保持 Automatic、团队 7R5Z28YJZ9；沿用此前核验的命令行限定 App 手动发行签名参数，不改签名材料。
- 自动检查（本轮实际执行）：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`（29 文件 **227/227**）、`pnpm build:ios`、`pnpm check:ios --release`、`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App` 全通过。日志 `release/qa/build8-{install,lint,vitest,web,static,resolve}.log`。
- Swift/XCTest（本轮实际执行）：在 ios/ComicNative 以 iPhone 18 Pro（25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB）运行完整 ComicNative 包 XCTest，**30/30 通过、0 失败**，结果 `release/qa/build8-native.xcresult`，日志 `build8-native.log`。随后 App Debug 模拟器构建 **BUILD SUCCEEDED**（`build8-debug.log`）。本轮无编译/测试失败，无跳过/删除/禁用测试。
- 归档与签名（成功）：`xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath release/LumiComic-build8.xcarchive ... archive`，追加此前成功的 `CODE_SIGN_STYLE=Manual`、本机 Apple Distribution 身份、`PROVISIONING_PROFILE_SPECIFIER='$(LUMICOMIC_PROFILE_$(PRODUCT_NAME))'` 与 `LUMICOMIC_PROFILE_App='LumiComic AppStore Build 6'`，**ARCHIVE SUCCEEDED**（`build8-archive.log`）。该描述文件标签不限定构建号，绑定本 App 与新发行证书，复用有效。证书类型本地 Apple Distribution，到期 2027-11-03（UTC+8），私钥留在本机钥匙串，未导出。
- 归档核验（通过）：实际 0.0.1(8)、Bundle ID/团队正确，codesign 深度严格验证通过，归档公开叶证书与已下载的新证书逐字节一致；内嵌描述文件只含该证书、get-task-allow=false、无设备列表；dSYM 存在，无 .storekit 测试文件，简繁桌面名「微光漫卷」、英文 LumiComic。
- 上传（成功）：通过 Xcode 已登录 Apple ID 执行 `xcodebuild -exportArchive -archivePath release/LumiComic-build8.xcarchive -exportOptionsPlist release/qa/build8-ExportOptions.plist -exportPath release/build8-upload -allowProvisioningUpdates`。2026-11-03 18:03:32（UTC+8）显示 `Upload succeeded` / **EXPORT SUCCEEDED**，退出 0。配置保留构建号、上传符号、指定同一新本机发行证书与描述文件，未使用旧 API Key N23VM7F87M；日志 `build8-upload.log`。
- Apple 处理（已完成）：用户恢复右侧浏览器登录后核验 0.0.1(8)，构建 id `14c98d3e-a73d-45fb-8d66-2c628ad00db6`；「构建版本上传」显示 **完成**，创建日期 Nov 3, 2026 6:03 PM，TestFlight 上传日期 2026-11-03 18:04，状态 **准备提交**、90 天后过期。据网页确认达到 VALID 目标，未调用 API 读取 processingState 原始字段。截图 `release/qa/build8-appstore-complete.png`。
- 必要元数据（已保存）：初次显示「缺少出口合规证明」。核对本轮新功能未新增自有加密算法，仍只用系统能力与既有 CryptoKit SHA256 文件指纹，参考 [Apple 说明](https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation)，在本构建「管理 → App 加密文稿」选择「不属于上述的任意一种算法」并保存，随后状态变为准备提交。网页登录曾过期，用户重新登录后完成；没有修改已上传二进制、提交 App Review，或主动添加群组/测试员。
- 模拟器更新启动（本轮实际执行）：安装并核验 Debug 0.0.1(8)，启动后原 5 本/4 系列、QA Borders 第 2/4 页保留，Pro 页显示六项已包含功能，关闭后返回书架正常；截图 `release/qa/build8-simulator-pro.png`。本轮未重做完整四阶段功能交互、真机、性能、真实退款/沙盒/家人共享；上一轮实际点检及未执行边界保留在下方。发行制品/导出配置/签名材料不入库。
- 记录与提交：构建号、两份交接记录与路线图中的最新测试构建同步为 8；全局 Git 身份未改，使用用户指定的单次提交身份。发布制品在 `release/LumiComic-build8.xcarchive` / `release/build8-upload`，均忽略不入库，证书/私钥/描述文件/API Key 不入库。

## 最新检查点：Pro 1.2 第二阶段——画面滤镜与四阶段收尾（2026-11-03）

- 自动翻页已在 `98f55f5` 提交并推送。画面滤镜已接入每书对比度、锐化、暖色，默认原图、免费还原、失去 Pro 时原图显示且保留参数。编辑草稿不解码，点击应用才保存/重建页面；取消不保存。系统 Core Image 处理预算内渲染图，先裁边再滤镜，独立参数缓存；原图分支不创建上下文。不改变进度/书签/原件，无数据库升级、无新增第三方依赖，filters 已标记交付。
- 自动检查（实际执行）：`pnpm lint`、`pnpm test`（29 文件 **227/227**，新增滤镜边界/权益/参数透传/持久化与故障安全 6）、`pnpm build:ios`、`pnpm check:ios --release` 全部通过；日志 `release/qa/pro-filters-final-{lint,vitest,web,static}.log`。App Debug `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` **BUILD SUCCEEDED**，日志 `pro-filters-final-debug.log`。
- XCTest（实际执行）：在 ios/ComicNative，`xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath <repo>/release/native-derived -resultBundlePath <repo>/release/qa/pro-filters-final-native.xcresult test`，**30/30 通过、0 失败**。新增 5 项覆盖非法桥接参数、原图同一图像/暖色/尺寸透明度、对比度锐化边缘变化、PDF 原图/滤镜/裁边缓存隔离与清理、原位 ZIP 不放大且原件不变。
- 失败与最小修复：首轮网页构建因新增英文文案含空格的键未加引号退出 2，补引号后通过。首轮 227 个 Vitest 有 1 个失败：测试错误假设初始化无设置，实际有两项；改为捕获并核对设置前后完整快照，保持“不改其他设置”的验证目的，随后 227/227。原生两次全量运行均 30/30，无 Swift 编译/测试失败；没有跳过、删除或禁用任何测试。
- 模拟器点检（实际执行，iPhone 18 Pro / iOS 27.2 / Debug）：自制原位 CBZ（4 页）与 PDF 副本（3 页）默认灰度原图；CBZ 应用 127% 对比度/54% 锐化/93% 暖色后画面变化，翻页、返回书架正常。打开 PDF 仍为默认原图，单独应用参数后效果正常；CBZ 重新打开保留第 2/4 页与原参数。英文滤镜说明/参数/按钮无溢出，补查上阶段英文自动翻页说明/常用间隔/速度；点击免费还原按钮恢复原图、仍第 2/4 页（此按钮实测时 Pro 有效，失去权益情况由策略/存储测试覆盖，未冒称退款实测）。临时两本清理后当前容器副本 6→5、引用 1→0，两份原件完整 SHA-256 与创建后记录一致；原 5 本/4 系列、既有 QA Borders 第 2/4 页保留，恢复跟随系统语言与网格布局。截图 `release/qa/pro-filters-{cbz-original,cbz-applied,english-settings}.png`，不入库。
- 未执行：真机、真实扫描页主观效果、长时内存/耗电/帧率、真实退款与沙盒/家人共享、本阶段模拟器滤镜+双页/条漫组合、iCloud/第三方原位提供者、安卓、Release 归档与新 TestFlight 上传。Xcode 当前调试另一个工程，本轮未中断该会话来操作 StoreKit 退款。模拟器与单元测试不能替代上述项目。
- 阶段收尾：原位阅读 `3061105`、批量整理 `7ee1a8b`、自动翻页 `98f55f5`、本阶段画面滤镜完成了约定代码、自动检查与可执行模拟器点检，按阶段推送 m0；具体未执行验收保留。TestFlight 仍 0.0.1(7)，本轮不归档/上传，不更改签名或构建号，不提交 release/ 与任何签名材料。四阶段 goal 在本次提交推送完成后结束。

## 最新检查点：Pro 1.2 第一阶段——自动翻页（2026-11-03）

- 1.1 两阶段已分别推送 `3061105`（原位阅读）、`7ee1a8b`（批量整理）。已完成单页/双页定时翻页与条漫匀速滚动：只有用户主动启动；触摸、键盘/滚轮、菜单、后台、缩放/旋转、坏页、卷末与权益失效停止，停止免费，不自动进入下一卷。计时从页面实际加载后开始，卡顿不追赶；条漫周期记录实际位置。间隔/速度可持久化，启动状态不持久化。
- 代码：单调时钟加载后计时、滚动步长限幅与周期实际位置保存，常用间隔/速度按钮；`ComicReader.setKeepAwake` 播放期间保持常亮，停止/网页重载恢复，App 失活有原生兜底。重连原件先 flush 最后位置再重开，避免进度尚未落盘的时序问题。UIKit 系统框架，无新依赖、无数据库升级，原文件不变。autoplay 已标记交付。
- 自动检查（实际执行）：`pnpm lint`、`pnpm test`（28 文件 **221/221**，新增时钟/滚动边界 6、参数持久化 1）、`pnpm build:ios`、`pnpm check:ios --release` 通过，最终日志 `release/qa/pro-autoplay-final-{lint,vitest,web,static}.log`。App Debug 模拟器构建使用与上阶段相同的项目、scheme、设备和 `CODE_SIGNING_ALLOWED=NO`，**BUILD SUCCEEDED**，日志 `pro-autoplay-third-debug.log`。本阶段无编译/测试失败，未跳过、删除或禁用测试。
- XCTest（实际执行）：在 ios/ComicNative 以同一 iPhone 18 Pro destination 运行完整 `xcodebuild -scheme ComicNative ... test`，**25/25 通过、0 失败**；日志 `release/qa/pro-autoplay-native.log`，结果 `pro-autoplay-native.xcresult`。
- 模拟器点检（实际执行，iPhone 18 Pro / iOS 27.2 / Debug / 简中）：导入自制 QA Autoplay 两卷与坏页书。单页自动至第 6/6 页停止，没有打开下一卷；双页自动显示第 2–3、4–5 页；第 4–5 页播放中切到主屏、等待 12 秒回前台，位置不变、没有自行恢复。条漫 4× 滚动到本卷底部后停止；坏页书自动翻到第 2 页显示失败后停止，没有跳过。设置恢复单页、5 秒、1×；清理三本测试书后当前容器副本 5、引用 0，原有 5 本/4 系列、QA Borders 第 2/4 页保留，布局恢复网格、语言仍跟随系统。截图与测试书在已忽略的 release/qa，不入库。
- 点检改进：范围滑块在模拟触摸时不易精确选定，补充常用参数按钮，并用按钮核对实际双页/条漫流程。模拟器定时截图不作为精确间隔或性能测量，时间边界由纯逻辑测试验证。
- 未执行：真机（自动锁屏、长时耗电/内存/帧率）、本阶段单独英文交互、RTL 自动翻页与旋转停止的模拟器交互、退款过程中自动停止、Release 归档与 TestFlight 上传。上述未执行项不记为通过；后续画面滤镜继续，goal active，测试发布构建仍为 7。

## 最新检查点：Pro 1.1 第二阶段——批量整理（2026-11-03）

- 第一阶段已提交并推送 `3061105`，goal 继续 active。批量整理已接入书架多选系列、系列内多选卷；可批量标记已读/未读、移入分组和从书架移除，原有单项管理及分组继续免费。打开时固定所选范围，应用前事务内核对书目变化；失败整批回滚，成功删除后由持久队列清理应用副本/原位引用，原件不动。
- 代码：`applyBatch` 单一事务去重、验证用户看到的实际书目集合；并发新增/删除造成范围变化则拒绝，读写失败全部回滚。`BatchDialog` 冻结打开时范围，删除前明确标题/数量/进度书签清除提示并先聚焦取消，分组按系列生效始终提示。`proPolicy` 已标记 batch 交付。无新依赖，无数据库升级，无 Swift 改动。
- 自动检查（实际执行）：`pnpm lint`、`pnpm test`（27 文件 **214/214**，新增 8 个批量事务/安全回归）、`pnpm build:ios`、`pnpm check:ios --release` 全通过。Debug `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` 通过。日志 `release/qa/pro-batch-final-{lint,vitest,web,static,debug}.log`。本阶段没有编译/测试失败，未跳过、删除或禁用测试。
- XCTest：本阶段**未重跑**（Swift 未改）；上一阶段 25/25 通过，不记成本阶段新执行。
- 模拟器点检（实际执行，iPhone 18 Pro / iOS 27.2 / Debug）：自制三本、两个系列（2 份副本 + 1 份原位），英文搜索 BATCH 后批量全选显示 2 项/3 本；批量标读完、移入临时 Group、在 Group 筛选核对仅 2 个已读系列、标未读均正常。删除确认逐项列出 2 个系列/3 本及影响，完成后当前应用容器副本 7→5、引用 1→0，三份原件仍存在且前后完整 SHA-256 一致；原 5 本/4 系列、既有第 2/4 页保留。新建空分组 999 后留在新分组，Group/999 临时分组已通过 UI 清理；恢复跟随系统语言。中文批量界面与确认清单核对，回车触发取消并保留原有书籍。另补查第一阶段英文原位导入入口/说明，无溢出。截图 `release/qa/pro-batch-{unread,removed,final-library}.png`，不入库。
- 点检发现与最小修复：新建分组后 liveQuery 快照尚未到达时，旧逻辑会错误返回全部书架；现先查询数据库确认缺失才退出，新分组 999 实测保持选中。删除确认增加取消按钮焦点，中文实测回车执行取消。
- 未执行：本阶段真机、VoiceOver 完整验收、退款后批量交互、模拟器系列内逐卷操作（纯逻辑测试覆盖部分卷按系列移动）、Release 归档与 TestFlight 上传；未新增测试员。下一阶段自动翻页与画面滤镜，goal 仍 active，构建仍为 7。

## 最新检查点：Pro 1.1 第一阶段——原位阅读（2026-11-03）

- 用户要求继续分阶段开发并开启 goal。基线 m0 `2124174`；工作区开始时干净，按 AGENTS.md 单代理执行。阶段依次为：1.1 原位阅读 → 1.1 批量整理 → 1.2 自动翻页 → 1.2 画面滤镜。每阶段实现、自动检查、模拟器/真机验收分别记录。
- 代码实现：系统文件选择 + 原生 `minimalBookmark` + 协调只读访问，默认免费副本导入保留；仅新增原位书需要 Pro，已有引用的阅读、重新授权与移除免费。每次原生读取验证原件大小/修改时间/格式，缺失或变化不直接使用旧页缓存；错误重选不能替换原授权；移除只清理引用与缓存。阅读失败页、阅读设置和单本管理均可重选，重选后刷新封面、保留页序/阅读进度/书签。复用已有表结构；新增可选作业 location、书籍 sourceUpdatedAt，无新依赖。`proPolicy` 已标记 inplace 交付。
- 自动检查（实际执行）：`pnpm lint`、`pnpm test`（26 文件 **206/206**）、`pnpm build:ios`、`pnpm check:ios --release` 全通过。日志 `release/qa/pro-inplace-final-{lint,vitest,web,static}.log`。Debug 模拟器 `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` 通过，日志 `pro-inplace-final-debug.log`。
- XCTest（实际执行）：在 ios/ComicNative 运行 `xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB' -derivedDataPath <repo>/release/native-derived -resultBundlePath <repo>/release/qa/pro-inplace-final.xcresult test`，**25/25 通过**（新增 6：PDF 持久引用与不删除原件、ZIP/CBZ/EPUB 渲染、缺失原件不返回旧缓存、变化/错误重选/正确恢复、路径/符号链接/书目身份边界、格式改名不能替换解码器）。新增 3 个 Vitest 覆盖 Pro 新增限制与不复制、重复/失败清理、授权中取消。
- 首轮失败与最小修复：24 例 XCTest 曾出现 4 个断言失败（1 个抛错）：URL 资源属性缓存使重新授权保存了旧修改时间；测试图片误用模拟器 3 倍倍率。清除 URL 缓存后读取属性、将测试素材明确生成为 1 倍像素，原断言保持；先重跑 24/24，再补格式边界回归后全量 25/25。没有跳过、删除或禁用测试。另在收尾检查补齐重连后的封面刷新及阅读失败页重选入口。
- 模拟器点检（实际执行，iPhone 18 Pro / iOS 27.2 / Debug / 简体中文）：免费点击原位入口打开购买页，本地 StoreKit 明示不收费的购买成功；系统文件选择器添加自制 QA InPlace Phase1.cbz，6 页封面/翻页正常，第 2/6 页退出/强退重启保留。重选另一册书被拒且保留原进度；不可用授权可从失败页重选原件并恢复第 2/6 页；关闭并重新启动该模拟器后仍能阅读第 2 页。磁盘核对 1 个引用、无对应漫画副本。最后从书架移除本次自制测试书，引用归零、原件仍存在且前后完整 SHA-256 相同，原 5 本/4 系列保留。截图 `release/qa/pro-inplace-{page2,reconnected,removed}.png`，不入库。
- 未执行：真机（含设备重启、权限撤销）、iCloud/第三方提供者、跨设备恢复、大文件性能、本轮单独英文界面交互、退款后原位交互、Release 归档与 TestFlight 上传。原生 XCTest 的临时文件不代表真实提供者授权已验收；已有原位书在失去 Pro 后可读/重选/移除由策略测试与无权益拦截的实现保证，未写成退款实测通过。
- PRD/开发计划外部链接本轮读取失败，未声称已读到；范围以已确认的 docs/PRO.md 与既有 Pro 策略为准。无新依赖，不改用户原文件、不引入运行时网络请求。TestFlight 构建仍为 7，本阶段尚未发布。
- 下一阶段：1.1 批量整理；目标与验收边界见 [docs/PRO_ROADMAP.md](./docs/PRO_ROADMAP.md)。持续 goal 保持 active，未把四阶段目标标为完成。

## 最新检查点：微光漫卷更名与 TestFlight 构建 7（2026-11-03）

- 用户确认中文桌面名改为「微光漫卷」，全名改为「微光漫卷-离线图片阅读器」，并明确要求生成、上传构建 7。基线 m0 `a893da5`，开始时工作区干净；已阅读 AGENTS.md、交接摘要、本文顶部及 iOS/Pro 说明，单代理执行。
- 代码实现：同步 iOS 默认及简繁体 CFBundleDisplayName/CFBundleName、Face ID 用途说明、应用锁提示、网页/原型品牌文案、Capacitor appName、安卓中文名称与 README。网页文档标题使用全名，英文标题译为 LumiComic - Offline Image Reader；英文桌面名仍为 LumiComic。Bundle ID `dev.weiguang.comic`、Pro 商品 ID 与存储键未改，未增加依赖。App Debug/Release 构建号 6→7，营销版本 0.0.1，工程签名仍为 Automatic、团队 7R5Z28YJZ9。
- 自动检查：首次 `pnpm lint` 仅因 index.html 的新 meta 文案触发 Prettier 换行要求，使用 `pnpm exec prettier --write index.html` 做最小格式修复；随后 `pnpm lint`、`pnpm test`（26 文件、203/203）、`pnpm build:ios`、`pnpm check:ios --release` 全部通过。`plutil -lint` 检查 Info.plist、三语 InfoPlist.strings 与 project.pbxproj 全部通过。日志 `release/qa/name-build7-*.log`。
- Swift/XCTest：最初原生复核命令误从包目录使用根目录相对日志路径，shell 重定向失败，尚未运行编译/测试；修正工作目录后，`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App` 成功。在 ComicNative 包目录，对 iPhone 18 Pro（25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB）运行完整 `xcodebuild -scheme ComicNative ... test`，**19/19 通过、0 失败**，结果包 `release/qa/name-build7-ComicNative-tests.xcresult`。随后 App Debug 模拟器构建 **BUILD SUCCEEDED**；未跳过、删除或禁用测试。
- 模拟器验收：更新安装到同一 iPhone 18 Pro / iOS 27.2，实际主屏图标名称为「微光漫卷」（截图 `name-build7-simulator-before-launch.png`）；实际启动成功，原 5 本漫画、4 个系列及 QA Borders 第 2/4 页进度保留（`name-build7-simulator-app.png`）。同时核验 Debug 与 Release 包内简繁体名称均为新名称、英文资源为 LumiComic。本轮未单独再做英文/繁体系统 UI 点检、全部 StoreKit/应用锁交互回归或真机验收。
- 签名与归档：首次手动命令被自动审批拒绝（认为 Automatic 要求及 Build 6 描述文件名冲突）；按建议先尝试 Automatic，实际因缺少开发描述文件退出 65。只读核验现有「LumiComic AppStore Build 6」描述文件仅绑定本 App ID、团队和同一新本机发行证书，没有构建号限制，名称只是标签。提交该核验及用户原始手动签名例外授权后，审批允许复用。限定描述文件只对 App target 生效的手动命令完成 **ARCHIVE SUCCEEDED**，归档 `release/LumiComic-build7.xcarchive`，保留旧构建 6 归档。
- 证书与归档核验：继续使用本机新 Apple Distribution（到期 2027-11-03），私钥未导出。codesign 深度严格验证通过，归档叶证书与已下载的新 .cer 逐字节一致；版本为 0.0.1(7)，Bundle ID 正确，无本地 .storekit 文件，中文资源名称正确。
- App Store Connect 名称：页面实际仍为旧名称，已在 App 信息的简体中文「名称」中保存用户指定全名，界面显示「已保存」，App 菜单亦显示新全名。截图 `release/qa/name-build7-appstore-name.jpg`。未提交 App Review，也未更改其他审核资料。
- 上传成功：使用 Xcode 已登录 Apple ID 执行 `xcodebuild -exportArchive -archivePath release/LumiComic-build7.xcarchive -exportOptionsPlist release/qa/name-build7-ExportOptions.plist -exportPath release/name-build7-upload -allowProvisioningUpdates`。导出配置明确 method=app-store-connect、destination=upload、manual、本机新证书、同一有效 App 描述文件、manageAppVersionAndBuildNumber=false、包含符号文件。15:29:30 日志显示 Upload succeeded / **EXPORT SUCCEEDED**，退出 0。未使用旧 API Key N23VM7F87M。
- Apple 处理成功：App Store Connect 的 0.0.1(7)，构建 id `238dc11e-8b14-44af-8a5b-ae6bf6d93e94`，创建时间 2026-11-03 15:29，「构建版本上传」已显示「完成」，TestFlight 显示「准备提交」、90 天后过期。处理后曾提示缺少出口合规信息；本轮只改名称、加密实现未变，沿用构建 6 已核验的系统能力分类，在页面选择「不属于上述的任意一种算法」保存后清除提示。以网页完成状态核验达到 VALID 目标，未调用旧 API Key；截图 `release/qa/name-build7-appstore-complete.jpg`。
- 收尾检查：最终 `pnpm lint` 再次通过，日志 `release/qa/name-build7-lint-final.log`；文档格式与 `git diff --check` 通过。提交前 `git fetch origin m0` 成功，本地与远端无分歧。
- 未执行：本轮真机与安卓启动器验收、单独英文/繁体系统界面复验、完整 StoreKit/应用锁交互回归、真实沙盒/家人共享内购、正式送审。本轮未添加测试员或测试群组。所有签名材料、导出选项、截图、日志及制品保留本地，不入库；提交仅包含改名、构建号 7 和交接记录。

## 最新检查点：新发行证书与 TestFlight 构建 6（2026-11-03）

- 基线：本机 macOS，Xcode 27.2（27B52）；克隆仓库后 `git checkout m0`、`git pull origin m0` 成功，HEAD `52ccd03`，初始工作区干净。已阅读 AGENTS.md、CODEX_HANDOFF.md、本文顶部、docs/IOS_B1.md、docs/PRO.md；README 中 PRD/开发计划外链仍不可访问，未宣称读过原文。
- 代码修复（模拟器复现）：在 ZIP 第 2 页由购买预览解锁并启用裁边后，返回书架按钮无响应。`src/reader/Reader.tsx` 的 effect 同时清理图片加载器和阅读会话，切换裁边重建加载器时误将 `leaving.current` 设为 true。将 `loader.dispose()` 独立为以 loader 为依赖的 effect，阅读会话继续随 writer 清理。修复版实测切换裁边后成功返回书架，进度仍是第 2 页。无依赖改动，无测试被跳过或删除。App Debug/Release 构建号已改为 6，营销版本保持 0.0.1，团队 7R5Z28YJZ9，工程保留 Automatic 签名。
- 环境：官方 Node v24.22.2 下载并经 SHA256 校验；安装于 `~/Library/Developer/WeiguangTools/node-v24.22.2-darwin-arm64`（后续命令需将其 bin 加入 PATH）。`node -v`、`npm install --global corepack`、`corepack enable`、`pnpm --version`（11.21.0）、`pnpm install --frozen-lockfile` 成功，锁文件未修改。
- 自动检查（实际执行）：`pnpm lint` 通过；`pnpm test` **26 文件、203/203 用例通过**；`pnpm build:ios` 通过；`pnpm check:ios --release` 通过。日志位于已忽略的 `release/qa/`。`plutil -lint` 检查 project.pbxproj 及三语 InfoPlist.strings 均通过，不等于 Swift 编译通过。
- Swift：`xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App` 重试通过。首次解析卡在 Capacitor 二进制下载，终止该进程后，用官方 release 地址下载 8.5.3 的 Capacitor/Cordova，并核对 SHA256 与 Package.swift 声明完全一致，放入 SwiftPM 缓存后恢复；依赖版本未修改。
- Swift 编译（实际执行）：在 ios/ComicNative 执行 `xcodebuild -scheme ComicNative -destination 'generic/platform=iOS Simulator' -derivedDataPath ../../release/native-derived CODE_SIGNING_ALLOWED=NO build-for-testing` 成功；App 执行 `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath release/app-debug CODE_SIGNING_ALLOWED=NO build` 成功。为利用运行时下载等待时间，先做编译预检；运行时安装后仍按用户要求执行全部 XCTest，再核验 App 构建。现有 ZIPFoundation 初始化器弃用/多余 try 警告、无 AppIntents 元数据提示不阻断构建，未为消除提示改动代码。XCTest 与后续 Debug 复核结果见下一条。
- XCTest（实际运行）：用户确认运行时安装完成后，`xcrun simctl list runtimes` 核验 iOS 27.2（24B8117）可用；iPhone 17（7396D51E-870D-4820-A6DF-C93C062207BB）执行 `xcodebuild -scheme ComicNative -destination 'platform=iOS Simulator,id=7396D51E-870D-4820-A6DF-C93C062207BB' -derivedDataPath ../../release/native-derived -resultBundlePath ../../release/qa/ComicNative-tests.xcresult test`，**19/19 通过，0 失败**（含 5 个 ContentBoundsTests）。随后以同一具体设备 destination 执行 App Debug 模拟器构建，**BUILD SUCCEEDED**。日志 `release/qa/xctest.log`、`app-debug-after-tests.log`，结果包亦在已忽略的 release 下。
- 修复后自动检查（实际执行）：`pnpm lint`、`pnpm test`（26 文件、203/203 通过）、`pnpm build:ios`、`pnpm check:ios --release` 全部通过。Xcode 重建并启动修复后 Debug App。日志在 `release/qa/*after-crop.log`。
- 收尾检查：`pnpm lint` 再次通过（日志 `release/qa/lint-final.log`），交接摘要最终更新后 `pnpm exec prettier --check CODEX_HANDOFF.md DEVELOPMENT_STATUS.md` 通过，`git diff --check` 通过。`git fetch origin m0` 成功，提交前 HEAD 与 origin/m0 无分歧。收尾仅修改记录，未再改动已验证的运行代码。
- 模拟器功能验收（11 月 2–3 日，iPhone 18 Pro / iOS 27.2）：Computer Use 已获得 Xcode 和 Device Hub 访问权限。Scheme → Run（Debug）→ Options 实际选中 `LumiComicPro.storekit`，由 Xcode 启动。此次 Xcode 产生的 scheme 和项目文件引用为本地调试配置，不纳入提交。
- 导入与阅读（通过）：从系统文件选择器选入自绘 ZIP、CBZ、PDF、图片 EPUB 各一本，四项导入完成。实际打开并翻页，ZIP 与 PDF 均显示第 2/4 页，CBZ 第 2/37 页、EPUB 第 2/12 页（两者左侧点按右翻）。
- Pro/裁边（通过）：免费状态开启裁边进入购买页，同一页显示原图与裁后图。应用购买按钮显示 ¥20.00，Xcode 测试交易表单提示不扣款。购买成功后应用显示已解锁，恢复购买经模拟认证后显示「已恢复购买」。关闭购买页后第 2 页内容扩大、白边缩小。修复后重启书架数据和进度保留。设置 → 微光 Pro 入口显示已解锁；退款后从设置入口打开购买页，实测价格 ¥20.00 与恢复购买按钮均显示。
- 隐藏（通过）：导入 QA Borders 第 2 卷组成两卷系列，管理 → 隐藏后书架从 4 个系列/5 本漫画变为 3 个系列/3 本漫画。设置 → 隐藏的系列 → 显示后，书架与继续阅读重新出现该系列；切回「不再显示」后设置按钮恢复为「显示」。退款后再次临时显示该系列，并在管理弹窗执行「取消隐藏」成功；设置页隐藏系列行消失，书架保持 4 个系列/5 本漫画。
- 本地化：已检查简中应用界面，SpringBoard 上应用图标的实际辅助功能名称为「微光漫画」。独立 iPhone 17 测试模拟器已通过 `simctl` 将 AppleLanguages 从 zh-Hans-CN 改为 en-US 并重启，读回确认 en-US；已安装与 dist 中修复版网页逐字节一致的 Debug App。英文系统 Spotlight 的实际应用标签为 LumiComic，已从该入口启动并检查英文空书架（My library、Your library is empty、Import comics、Library/Recent/Settings）。已通过主屏的 App Library 导航回到第 2 页，实测图标与辅助功能标签均为 LumiComic，中英文名称核验完成。
- 应用锁（模拟器通过）：启用后的 App 冷启动显示系统 Face ID 提示，发送匹配通知后成功进入原书架。进入多任务时 App 卡片为纯色锁图标，未露出书架内容。回到主屏再打开 App 会重新验证；模拟不匹配后点击系统「取消」，停在「微光漫画已锁定」页面；点击「用面容 ID 解锁」并模拟匹配后成功进入。阅读 QA Borders 第 2/4 页时返回主屏、重开并验证，仍显示相同 QA PAGE 2，工具栏亦为第 2/4 页。未修改认证实现。
- 退款（通过）：Xcode Manage StoreKit Transactions 对本地购买 ID 0 执行 Refund，详情变为 Refunded，撤销时间 11 月 3 日 00:46。App 恢复免费状态，原有 5 本漫画、阅读进度与系列均保留，免费状态取消隐藏通过。为继续锁测试完成第二笔本地购买 ID 1；应用锁启用后于 11 月 3 日 07:33 再次 Refund，交易详情为 Refunded，App 的 Pro 描述恢复免费状态，应用锁「关闭」仍可操作。点击关闭后按钮变为「开启」，回到主屏再打开直接进入设置，不再要求认证。
- 模拟认证环境（仅测试模拟器）：用户确认从未设置模拟器密码。Device Hub 的 Face ID Enrolled 菜单不可用；首次登记通知被自动审批拒绝，用户明确批准该具体操作后，执行 `xcrun simctl spawn 25D3E645-55A3-44F9-B7FE-7CED6E0DB7AB notifyutil -s com.apple.BiometricKit.enrollmentChanged 1 -p com.apple.BiometricKit.enrollmentChanged` 成功。用户另行明确授权同一模拟器的 `com.apple.BiometricKit_Sim.pearl.match` / `pearl.nomatch`；实际通过 `notifyutil -p` 发送并在界面观察上述匹配、不匹配、取消和重试结果。先前多次 Mac 锁屏使观察中断；11 月 3 日恢复设备及 Xcode 会话后完成复核。此结果不代表真实 Face ID 硬件或设备密码验收。
- 证书（用户创建后已核验）：本地 Apple Distribution，主体团队 7R5Z28YJZ9，到期日 2027-11-03（北京时间）。`security find-identity -p codesigning` 初次显示 1 个匹配身份但 0 个有效身份；本机仅安装 2023 年过期的旧 WWDR 中间证书。使用 Apple 官方 `https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer` 下载 G3，`openssl x509` 与 `security verify-cert -p basic` 核对主体、2030 年到期及链验证成功，再用 `security add-certificates` 补入登录钥匙串。随后 `security find-identity -v -p codesigning` 为 **1 个有效 Apple Distribution 身份**，证书与本机私钥关联。未修改根信任或验证策略，未导出私钥、未生成 .p12；临时公开证书仅在 /private/tmp，不入库。
- 发行描述文件：用户明确批准后，在 Apple Developer 生成「LumiComic AppStore Build 6」并下载至本机 Downloads。通过 `security cms -D -i` 核验团队、App ID、App Store 类型（get-task-allow 为 false、无设备清单），且唯一证书与本机新发行证书一致；安装至 Xcode UserData/Provisioning Profiles。描述文件不入库，生成结果截图位于已忽略的 `release/qa/profile-build6-generated.jpg`。
- build 6（归档成功）：首次执行 `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath release/LumiComic.xcarchive archive`，退出 65，自动签名缺少该 App 的开发描述文件（尚未进入编译，不是测试失败），日志 `archive-build6-automatic.log`。改为命令行指定新发行证书和 App Store 描述文件后，第二次退出 65：全局 PROVISIONING_PROFILE_SPECIFIER 被错误传给 ZIPFoundation 资源 bundle，该 target 不支持描述文件，日志 `archive-build6-distribution.log`。最小修复仅调整本地归档参数，以 `PROVISIONING_PROFILE_SPECIFIER='$(LUMICOMIC_PROFILE_$(PRODUCT_NAME))'`、`LUMICOMIC_PROFILE_App='LumiComic AppStore Build 6'` 只对 App 设置描述文件，未改代码、测试或依赖。`-showBuildSettings -json` 核验 App 为 0.0.1(6)、正确团队和新证书、正确描述文件。第三次在原始归档命令追加 `CODE_SIGN_STYLE=Manual`、`CODE_SIGN_IDENTITY='Apple Distribution: Zhiliang Liao (7R5Z28YJZ9)'`、上述作用域参数及 `DEVELOPMENT_TEAM=7R5Z28YJZ9`，用户在系统钥匙串弹窗授权新私钥后，退出 0，**ARCHIVE SUCCEEDED**。工程文件仍保持 Automatic。成功日志 `release/qa/archive-build6-distribution-scoped.log`；归档及 dSYM 在已忽略的 `release/LumiComic.xcarchive`。
- 归档签名核验（通过）：`codesign -dvv release/LumiComic.xcarchive/Products/Applications/App.app 2>&1 | grep Authority` 在可读系统钥匙串的环境显示 `Apple Distribution: Zhiliang Liao (7R5Z28YJZ9)` → WWDR → Apple Root CA。默认沙箱读取链显示 unavailable，不作为实际证书结论。`codesign --verify --deep --strict --verbose=2` 通过。`codesign -d --extract-certificates=/private/tmp/weiguang-build6-signing- .../App.app` 提取的公开叶证书与开发者网站下载的新 .cer 逐字节相同，内嵌描述文件亦只包含该新证书；`get-task-allow=false`、无设备清单，Bundle ID 正确，版本 0.0.1 / build 6，dSYM 存在，无 .storekit 测试配置。提取命令初次缺少选项等号导致参数被误当路径，修正语法后通过，无需重建归档。
- Organizer 上传签名配置（已完成）：进入 Distribute App → Custom → App Store Connect → Upload 的准备流程，关闭 Manage version and build number，保留归档 0.0.1(6)；包含符号文件，未勾选仅限内部测试。证书明确选择 `Apple Distribution – Created 2026/11/3`，App.app 描述文件选择「LumiComic AppStore Build 6」，Capacitor/Cordova 不需要描述文件。Next 后到达 `Review App.ipa content`，摘要显示新发行证书和描述文件均于 2027/11/3 到期、团队正确、application-identifier 正确、get-task-allow=false、符号已包含、arm64、0.0.1(6)。截图 `release/qa/build6-upload-review.png`。这是本地上传前摘要核对，不等于已上传或已通过 Apple 处理。
- build 6 上传（成功）：用户明确授权代理完成上传后，在 Organizer 点击最终 Upload，Xcode 显示 `App upload complete: App 0.0.1 (6) uploaded`。通过当前 Apple ID 账户上传，未使用旧 API Key。截图 `release/qa/build6-upload-complete.png`。
- build 6 处理状态（已完成）：App Store Connect 的 0.0.1(6)，创建时间 2026-11-03 08:17（页面时间），构建 id `3dd8a6a5-42b8-4e9e-82b7-ac7496e67fb7`。「构建版本上传」已显示 **完成**，TestFlight 构建状态 **准备提交**、90 天后过期，据此确认 Apple 已成功处理，达到 VALID 目标；本轮通过网页核验，没有调用 API 读取 processingState 原始字段。截图 `release/qa/build6-appstore-complete.jpg`。本轮未提交 App Review，也未主动添加测试群组或测试员。
- 上传后元数据处理：构建处理完后曾提示「缺少出口合规证明」。核对代码仅使用系统 CryptoKit SHA256 文件指纹、LocalAuthentication 与系统随机 ID，没有自带加密实现；并阅读 Apple 官方加密出口说明。在 App Store Connect 的「App 加密文稿」选择「不属于上述的任意一种算法」并保存，状态随后变为「准备提交」。本次通过构建元数据补充完成，未改动已上传二进制。
- 备案材料准备：已从 Apple Developer 下载新证书的公开 `distribution.cer` 至本机 Downloads，核对其与新钥匙串签名身份一致；已用 `openssl x509 -inform der` 计算 MD5、模数和 PEM 公钥，结果不写入仓库，待向用户汇报。未导出私钥。
- 未执行：全部真机验收、真实 Face ID/设备密码与性能测量，真实商店/沙盒内购与家人共享测试，App Review 提交。私钥 .p12 另行加密备份由用户完成；旧 API Key N23VM7F87M 吊销、¥20 非消耗型内购 dev.weiguang.comic.pro 创建并开启家人共享、TestFlight 测试员分配仍交给用户。
- 环境故障与恢复（11 月 3 日）：用户确认手动也无法切换 Device Hub 设备。正常退出并重开 Device Hub 后，设备列表与 App 触控恢复。设备退出令旧调试会话收到 SIGTERM，结束旧会话后重新 Run 成功，书架与本地交易仍保留。此过程未清空模拟器。后续再次恢复已退出的 Xcode/模拟器并 Run，Debug 构建成功。
- 交付范围：Generate 首次被自动审批拒绝，用户明确批准后生成及安装完成；用户完成钥匙串授权，并进一步明确授权代理执行最终 Upload，现上传与 Apple 处理均成功。本机 StoreKit scheme 与本轮生成的 SwiftPM 解析文件仅在本仓库 .git/info/exclude 排除，保留供本地调试；提交范围仅构建号/团队、Reader 最小修复及两份文档。证书、公钥/指纹结果、描述文件、API Key、release 制品不入库，Git 全局身份未修改。

## 最新检查点：M3-04 应用锁与隐藏系列（第二项 Pro 功能，开放购买，2026-11-02）

- 原生：新增 `ComicLockPlugin`（LocalAuthentication `deviceOwnerAuthentication`，面容/触控 ID 失败可回落设备密码；只返回是否通过）。`ComicBridgeViewController` 实现隐私遮挡：应用锁开启时进入多任务/后台即盖住画面，从后台回来等网页画出锁屏并调用 `reveal` 后才移开（1.5 秒兜底）。Info.plist 与三语 InfoPlist.strings 增加 `NSFaceIDUsageDescription`；`check:ios` 检查注册与该键。系统框架，无新依赖。
- 网页层：`src/app/appLock.ts` 状态机（启动与回到前台上锁、自动发起验证；开启需 Pro + 设备密码并先验证一次；关闭与解锁永远可用；设备关闭密码时放行并自动关闭应用锁），设置存 `settings` 表 `app.lock`（新键，不改表结构）。`LockScreen` 盖住书架与阅读器且不卸载它们（阅读位置保留）；读到锁设置前不渲染书架。
- 隐藏系列：复用已有 `series.hidden`；系列管理弹窗「隐藏系列 Pro / 取消隐藏」（取消隐藏不需要 Pro）；隐藏系列不出现在书架、最近、继续阅读和搜索；设置页「隐藏的系列 · 显示」仅本次打开有效。
- `proPolicy` 两项均标为已交付 → `purchaseOpen` 为 true：正式商店也会显示「微光 Pro」入口与 Pro 开关。上架前须在 App Store Connect 创建内购商品（见 docs/PRO.md）。
- 自动检查（实际执行）：`pnpm test` 203 用例通过（新增 8：应用锁 7、隐藏/显示 1+1 断言扩充）；`pnpm lint`、`pnpm build`、`pnpm build:ios`、`pnpm check:ios --release` 通过；临时预览页检查 375/1280 锁屏布局（已删除）。
- 未测：Swift 编译、面容 ID/密码真机流程、后台遮挡与回前台时序、阅读中上锁后恢复、沙盒内购开放后的完整购买流程。

## 上一检查点：M3-03 自动裁白边（第一项 Pro 功能，2026-11-02）

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
