# 微光漫卷 1.0 上架表单交接（给 Codex）

更新：2026-11-10｜代码基线：`m0` `08e6d64`｜待送审构建：**1.0.0 (11)**

本文给接手填写 App Store Connect（下称 ASC）表单的代理使用：列出每个表单该填什么、可直接粘贴的文案、需要用户拍板的事项，以及禁止代办的操作。先读本文，再按需查 [CODEX_HANDOFF.md](../CODEX_HANDOFF.md)、[DEVELOPMENT_STATUS.md](../DEVELOPMENT_STATUS.md) 顶部和 [PRO.md](./PRO.md)。

## 0. 操作边界（必须遵守）

- **不点「提交以供审核」**。所有表单填好、自查清单全部打勾后，把截图和摘要交给用户，由用户确认后再提交（或用户自己点）。
- 不代填或代签：付费 App 协议、银行与税务信息、ICP 备案、账号密码、两步验证码、审核联系人的真实姓名/电话/邮箱。这些只提醒用户。
- 不改价格档位、不改 Bundle ID/商品 ID、不删除任何构建或内购项目；不新建第二个 App。
- 截图与宣传图**不得出现任何有版权的漫画**（包括用户手机里的漫画截图），只用自绘或明确可商用的原创画面。
- 网页登录过期就停下请用户重新登录，不尝试绕过；不使用旧 API Key `N23VM7F87M`。
- 改动仓库时遵守 [AGENTS.md](../AGENTS.md)；签名材料、截图原件、日志放已忽略的 `release/`，不入库。

## 1. App 基本信息（已定，照填/核对）

| 项目                     | 值                                                                           |
| ------------------------ | ---------------------------------------------------------------------------- |
| App Apple ID             | 6829142764                                                                   |
| Bundle ID                | `dev.weiguang.comic`                                                         |
| 团队                     | 7R5Z28YJZ9                                                                   |
| SKU                      | 以 ASC 现有值为准，不改                                                      |
| 主屏名称                 | 简/繁「微光漫卷」，英文 LumiComic                                            |
| 商店名称（简中，已保存） | 微光漫卷-离线图片阅读器                                                      |
| 版本 / 构建              | 1.0.0 / 11（2026-11-07 14:54 上传成功；先核对处理完成，再在版本页选择）      |
| 最低系统                 | iOS 15.0                                                                     |
| 设备                     | iPhone + iPad（`TARGETED_DEVICE_FAMILY = 1,2`），因此必须提供 iPad 截图      |
| App 内语言               | 简体中文、英文（繁中只有主屏名称）                                           |
| 出口合规                 | Info.plist 已设 `ITSAppUsesNonExemptEncryption = NO`，构建 10 起无需逐个回答 |
| 登录                     | 无账号、无登录；全程离线，不发网络请求                                       |

## 2. 用户需先完成或拍板的事项

处理前先在 ASC 查看当前状态，已完成的跳过并记录。

| #   | 事项              | 说明                                                                                                                                                                    |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | 付费 App 协议生效 | 协议、税务和银行三项都为「有效」。不生效时内购在审核时无法加载，必被拒。                                                                                                |
| U2  | ICP 备案号        | 国区上架需要在 App 信息中填写。备案绑定 Bundle ID 与当前发行证书（公钥/MD5，到期 2027-11-03）。未完成时二选一：等备案；或首发暂不选「中国大陆」销售范围（由用户决定）。 |
| U3  | 隐私政策网址      | 正文见 [PRIVACY_POLICY.md](./PRIVACY_POLICY.md)（与 App 内一致）。仓库是私有的，需要用户把它放到公开可访问的网页（中国大陆可打开为佳），把网址给你。                    |
| U4  | 技术支持网址      | 必填。可与隐私政策同一站点，放一个简短支持页（联系方式由用户提供）。隐私政策里写的联系方式就是「App Store 产品页的 App 支持链接」，因此这个页面必须能联系到开发者。     |
| U5  | 主分类            | 建议主分类「图书」、次分类「工具」，用户确认。                                                                                                                          |
| U6  | 审核联系信息      | 姓名、电话、邮箱由用户本人填写。                                                                                                                                        |
| U7  | 版权行            | 建议 `© 2026 ` 加 ASC 账户显示的开发者名称，用户确认。                                                                                                                  |
| U8  | 审核测试素材链接  | 见第 8 节：需要一个公开可下载的原创样例漫画链接。                                                                                                                       |

## 3. 版本页文案（可直接粘贴）

字数限制：名称、副标题各 30 字符；推广文本 170；描述 4000；关键词 100（逗号分隔、不加空格）。下列文案均已在限制内。描述只写已实现的功能——**不要写 RAR、CBR、图片文件夹、云同步、书源**，这些都未实现（审核 2.3）。

### 简体中文（主要语言）

副标题：

```text
本地漫画阅读 · ZIP/CBZ/PDF/EPUB
```

推广文本：

```text
只读你自己的漫画文件：不联网、不登录、不内置任何资源。单页、双页、条漫三种模式，自动按系列和卷排好，阅读进度与书签都只保存在这台设备上。
```

关键词：

```text
漫画阅读器,CBZ,ZIP,PDF,EPUB,本地漫画,离线,条漫,双页,漫画,看漫画,阅读器,日漫,书架
```

描述：

```text
微光漫卷是一款只读取你自己文件的离线漫画阅读器。没有账号，没有广告，不联网，不内置、不推荐任何漫画资源——书架上的每一本，都来自你自己的“文件”App。

【导入与整理】
· 从“文件”导入 ZIP、CBZ、PDF 和图片漫画 EPUB，可以一次多选
· 自动识别系列、卷与话，按自然顺序排好；重复文件自动跳过
· 自定义分组、收藏、搜索与筛选，继续阅读一键回到上次的位置
· 导入时复制一份到 App 内，原文件不会被修改

【阅读】
· 单页、双页、条漫三种模式，支持从右向左翻页
· 读取漫画包中的日漫方向标记，自动设为从右向左
· 双击或捏合缩放，目录与缩略图快速跳页，书签
· 自动记住阅读进度，读完一卷可直接打开下一卷
· 阅读亮度、背景（自动 / 纯白 / 纯黑）、全屏沉浸
· 简体中文与英文界面

【微光 Pro · 一次买断】
不订阅。阅读功能永久免费，Pro 为可选的一次性购买，后续更新免费获得，支持家人共享：
· 自动裁白边：去掉扫描版四周的白边和黑边，画面更大
· 应用锁与隐藏系列：用面容 ID 或密码进入，切到后台时遮住画面
· 原位阅读：直接读取“文件”中的原件，不再复制一份
· 批量整理：多选后一次移入分组、标记已读或删除
· 自动翻页：按设定间隔翻页，条漫匀速滚动
· 画面滤镜：调节对比度、锐化与暖色，不改动原文件

【隐私】
不收集任何个人信息。漫画、书架、进度与设置都只保存在这台设备上。

微光漫卷不提供任何漫画内容，请只导入你有权阅读的文件。
```

### English（若添加英文本地化）

英文商店名称不能沿用 App 内的长英文名（超过 30 字符），建议：

```text
LumiComic: Offline Reader
```

Subtitle:

```text
Read your own CBZ, PDF & EPUB
```

Promotional text:

```text
Read your own comic files: no sign-in, no network, nothing built in. Single page, spreads and vertical scroll, series sorted for you, progress kept on this device.
```

Keywords:

```text
comic,reader,cbz,zip,pdf,epub,manga,offline,webtoon,library,viewer
```

Description:

```text
LumiComic is an offline comic reader for your own files. No account, no ads, no network, and no built-in or recommended comics — everything on your shelf comes from your own Files app.

IMPORT AND ORGANIZE
• Import ZIP, CBZ, PDF and image-based EPUB from Files, several at once
• Series, volumes and chapters are detected and sorted naturally; duplicates are skipped
• Custom groups, favorites, search and filters; Continue Reading takes you back where you left off
• Imports are copied into the app; your original files are never modified

READ
• Single page, two-page spread and vertical scroll, with right-to-left support
• Right-to-left manga flags in comic archives are applied automatically
• Double-tap or pinch to zoom, table of contents with thumbnails, bookmarks
• Progress is saved automatically; open the next volume when you finish one
• Brightness, background (Auto / White / Black) and full-screen reading
• English and Simplified Chinese interface

LUMICOMIC PRO · ONE-TIME PURCHASE
No subscription. Reading stays free forever. Pro is an optional one-time purchase with future updates included and Family Sharing:
• Auto crop: trims white and black borders from scans
• App lock and hidden series: Face ID or passcode, content hidden in the app switcher
• Read in place: open originals in Files without making a copy
• Batch organize: move, mark as read or delete many items at once
• Auto page turn: timed page turns and smooth vertical scrolling
• Image filters: contrast, sharpening and warmth, without changing your files

PRIVACY
No personal data is collected. Your comics, library, progress and settings stay on this device.

LumiComic does not provide any comics. Only import files you have the right to read.
```

## 4. 截图要求

- **iPhone 6.9 英寸**（必需）：1320×2868 或 1290×2796，竖屏 3–10 张。可用 iPhone 18 Pro Max 模拟器（1320×2868）截取。
- **iPad 13 英寸**（必需，因支持 iPad）：2064×2752 或 2048×2732。可用 iPad Pro 13-inch (M5) 模拟器。截图前先在该模拟器上走一遍导入和阅读，确认布局正常——iPad 只做过书架点检，阅读和分屏还没测过；发现问题先报告，不要硬截。
- 画面只用原创内容。`test-books/` 和 `scripts/make_test_books.py` 生成的是「QA PAGE n」占位页，可用于功能截图，但不够美观；更好的做法是请用户提供或确认一组可商用的原创插画，打包成 CBZ 后导入模拟器再截。**禁止**使用任何商业漫画（包括用户手机截图里的那类作品）。
- 建议顺序：①书架（系列叠放 + 继续阅读）②单页阅读 ③条漫 ④双页 + 从右向左 ⑤目录/缩略图 ⑥微光 Pro 页面 ⑦设置（含隐私政策入口）。中文、英文各一套（若添加英文本地化）。
- 截图不加设备边框也可以；如果加文字说明，只描述已实现的功能。

## 5. App 隐私（营养标签）

- 数据收集：选「否，我们不从此 App 中收集数据」→ 结果为「未收集数据」。
- 依据：App 不发网络请求，无第三方 SDK、无统计分析、无广告；Apple 自己按用户授权共享的崩溃报告不属于开发者收集。
- 隐私清单 `ios/App/App/PrivacyInfo.xcprivacy` 已声明不跟踪、不收集，与此一致。
- 隐私政策网址填用户提供的 U3 网址。

## 6. 年龄分级（新问卷）

逐项选「无 / 否」：暴力、色情/裸露、恐怖、成人主题、药物/酒精/烟草、赌博与模拟赌博、竞赛、医疗与健康信息、粗俗语言、不受限制的网页访问、用户生成内容、私信/聊天、广告、位置共享等。App 内控制（家长控制、年龄验证）均无。预期结果 **4+**。

如果问卷要求说明，可填：「App 只显示用户自己从“文件”导入的文件，不提供、不推荐、不下载任何内容，也没有网页浏览和社交功能。」

## 7. App 内购买项目

在「App 内购买项目」新建，或核对已有的同 ID 项目：

| 字段              | 值                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型              | 非消耗型                                                                                                                                        |
| 参考名称          | LumiComic Pro                                                                                                                                   |
| 产品 ID           | `dev.weiguang.comic.pro`（必须一致，代码写死）                                                                                                  |
| 价格              | 中国大陆 ¥20 对应档位（美区约 US$2.99），以档位表为准，选好后请用户确认                                                                         |
| 家人共享          | 开启                                                                                                                                            |
| 显示名称（简中）  | 微光 Pro                                                                                                                                        |
| 描述（简中，≤55） | 一次买断，解锁全部 Pro 功能，后续更新免费获得。                                                                                                 |
| 显示名称（英文）  | LumiComic Pro                                                                                                                                   |
| 描述（英文，≤55） | Unlock every Pro feature once. Updates included.                                                                                                |
| 审核截图          | 购买页截图：设置 → 微光 Pro → 查看（模拟器截图即可，不能出现商业漫画）                                                                          |
| 审核备注          | 一次性购买，解锁 6 项功能：自动裁白边、应用锁与隐藏系列、原位阅读、批量整理、自动翻页、画面滤镜。入口：设置 → 微光 Pro → 查看；含「恢复购买」。 |

首次提交时，在 1.0.0 版本页「App 内购买项目」区域把该商品勾选进本次提交，否则商品不会随版本审核。

## 8. App 审核信息

- 需要登录：**否**。
- 联系信息：用户本人填写（U6）。
- 附件：可选，附一段 30–60 秒的操作录屏（导入 → 阅读 → Pro 页面），只用原创素材。
- 审核备注（中英文都放上，审核员多用英文；把 `<样例下载链接>` 换成 U8 提供的地址）：

```text
微光漫卷 / LumiComic is an offline reader for the user's own comic files. It has no account, makes no network requests, and contains no built-in comics, so the library is empty on first launch.

How to test:
1. On the test device, open <样例下载链接> in Safari and download the sample files (our own original artwork) to Files.
2. Launch the app and tap “Import comics” / “导入漫画”, then select the samples in Files (multi-select is supported).
3. Open a book: tap the center to show the toolbar. Single page, two-page spread and vertical scroll are available in the toolbar; reading settings are under the gear icon.

In-app purchase: Settings → LumiComic Pro → View. It is a one-time non-consumable purchase (dev.weiguang.comic.pro) with Restore Purchases on the same page. Reading features stay free.

App lock (Pro) uses Face ID / Touch ID / device passcode through the system, and requires a device passcode to be set.

The privacy policy is available in the app under Settings → Privacy Policy.
```

## 9. 定价与销售范围

- 价格：**免费**（含 App 内购买）。
- 销售范围：默认全部地区；中国大陆是否勾选取决于 U2。
- 预订、分阶段发布：不需要。可选「审核通过后手动发布」，由用户决定上线时间。

## 10. 其他表单

- 内容版权：App 本身不包含、不提供第三方内容，只显示用户自己导入的文件，建议选「否」。如问卷措辞把用户文件也算作第三方内容，停下请用户决定。
- 广告标识符（IDFA）：不使用。
- 加密：构建已声明豁免，版本页不应再出现出口合规问题；如仍出现，选「不属于上述任意一种算法」并告知用户。
- 「App Store 推荐」/ 宣传图：首发不需要。

## 11. 已知情况（填表时可能被问到）

- 已验证：lint、233/233 Vitest、32/32 XCTest、Release 归档与签名、模拟器多轮功能点检（四种格式、Pro 六项、应用锁、浅/深色启动图、中英隐私政策）。
- **未验证**：真机、沙盒真实购买/恢复、iPad 阅读与分屏、性能与内存。建议用户在送审前用 TestFlight 构建 11 在自己的 iPhone 上至少走一遍：导入、翻页、Face ID、沙盒购买和恢复。
- 小问题（不阻塞审核）：英文设置页「外观」下拉在窄屏被截成「Syst」；冷启动网页加载前的空白底色不随深色模式。
- 不在 1.0 范围：RAR/CBR、图片文件夹导入、「用…打开」/分享导入、备份、安卓版。（「用…打开」/分享导入已在 2026-11-12 实现，随 1.0.1 发布。）

## 12. 提交前自查清单（全部打勾后交给用户）

- [ ] U1 付费协议有效；U2 备案号已填，或用户已决定不选中国大陆
- [ ] 隐私政策网址、技术支持网址可公开访问
- [ ] 名称、副标题、推广文本、描述、关键词已填，且只写已实现的功能
- [ ] iPhone 6.9 英寸和 iPad 13 英寸截图已上传，没有商业漫画
- [ ] App 隐私显示「未收集数据」
- [ ] 年龄分级问卷完成（预期 4+）
- [ ] 内购 `dev.weiguang.comic.pro` 状态为「准备提交」，含审核截图，并已勾选进 1.0.0 版本
- [ ] 构建选择 1.0.0 (11)，且 Apple 已处理完成
- [ ] 审核备注含样例下载链接，链接在手机 Safari 可下载
- [ ] 价格免费；销售范围符合 U2 决定；发布方式已与用户确认
- [ ] 把各页面截图和本清单交给用户确认，**由用户决定是否提交审核**

完成后在 DEVELOPMENT_STATUS.md 顶部新增检查点，记录已填写项目、未完成项目和用户待办；只提交文档改动。
