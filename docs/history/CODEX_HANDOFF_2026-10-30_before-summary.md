# 微光漫画交接说明（给 Codex）

更新：2026-10-30。接手前按顺序读：本文 → `AGENTS.md` → `DEVELOPMENT_STATUS.md`。PRD 与开发计划的全文在 claude.ai 文档里（链接见 README.md，需要登录才能打开）；本文已摘录开发所需的全部要点，如有冲突以 PRD 与开发计划为准。

**最新变更（M1-02/03 代码准备）**：正式 ZIP/CBZ 多选导入、原生分块复制、进度/取消、原子入库、基础重复检测、中断副本清理和书架结果列表已接入。正式副本在 `ComicLibrary/`，原型仍使用 `ComicPrototype/`。新增8个用例，当前共22个 Vitest，均未运行；两端网页构建/同步、iOS 静态检查和窄屏界面检查通过，Swift 与真机尚未验收。安卓正式原生导入、系统分享/“用…打开”、图片文件夹、封面书架和正式阅读器仍未完成。下一步先补系统分享入口与待接收队列。见 `docs/IMPORT_M1.md` 与最新检查点。以下旧任务表和“下一步”保留历史，发生冲突时以本段及最新检查点为准。

**执行方式调整**：用户目前没有 Mac，Windows 上继续准备界面、存储和纯逻辑代码，B1及性能闸门保留待验收；不要把代码已写或网页构建通过等同于 iOS 验收。已预先加入 M1-01 的8表 Dexie v1、默认设置、建库失败重试与3个数据库回归用例；测试尚未执行，数据库在正式书架入口打开，M0原型不加载它。详见最新检查点。当前仍未提交。

**最新变更（M0-05）**：iOS 工程已在 Windows 生成，原生 ZIP/ZIP64 与 ImageIO 原型、Debug 导入/阅读测试入口已写入；网页构建与静态连接检查通过，Swift 编译、安装包体积及真机性能未测。详见 `DEVELOPMENT_STATUS.md` 最新检查点与 `docs/IOS_B1.md`。以下任务表与第5、8节保留原交接记录，涉及“iOS未生成”等内容以最新检查点为准。当前分支 `m0`，未提交，闸门一仍未通过。

## 1. 产品一句话

只读用户自己文件的本地漫画阅读器。导入 CBZ/ZIP/RAR/图片文件夹/漫画 EPUB，按系列自动排好，用翻页、条漫、双页方式阅读。不联网、不登录、不内置任何漫画来源、不做 AI。iOS 先行，安卓开发期同步验证、晚一个版本发布，首版不做网页版。

三个已用数据验证的卖点（M0-01，309 条竞品差评）：

1. 收费方式：核心功能永久免费、不做计时试用、已有功能不收回、Pro 一次买断（收费类差评占 28–37%）。
2. 稳定性：大文件、长条漫不卡不闪退（卡顿闪退类占 22–24%）。
3. 导入与整理：整个文件夹一次导入，自动按卷、话排好（占 7–12%）。

文件名乱码修复和隐私是必须做到的基础能力，但不当卖点。

## 2. 已定决策（2026-10-29）

| 事项            | 结论                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------- |
| 应用标识        | Bundle ID / appId `dev.weiguang.comic`；Pro 商品 `dev.weiguang.comic.pro`（StoreKit 非消耗型） |
| 名称            | 中文「微光漫画」，英文暂定 LumiComic（商标与重名待用户确认）                                   |
| 仓库            | 本仓库 `D:\微光漫画`，独立于微光阅读；共用代码先复制                                           |
| 测试执行        | 平时只做类型检查和构建；闸门一、闸门二和提交审核前各跑一次全部 Vitest                          |
| 安卓            | 开发期同步验证，发布晚一个版本；不申请网络权限                                                 |
| iCloud 整机备份 | 漫画文件副本标记为不计入备份                                                                   |
| Pro 定价        | 国区 ¥30 档、美区 US$4.99 档、台区对应档位，开启家人共享                                       |
| 国区备案        | 第 6 周前查清是否强制，沿用微光阅读的做法                                                      |
| 最低系统        | iOS 15，与微光阅读一致                                                                         |
| 商店文案        | 名称、副标题、截图不写价格（审核指南 2.3.7）；收费承诺写在描述开头和宣传文本                   |

## 3. 关键技术决定

- **压缩包读取和大图解码放在原生层**。WebView 每翻一页向原生要一张按屏幕尺寸降采样后的图（写入缓存文件，返回本地地址）。几 GB 的压缩包和原图都不进 WebView 内存。微光阅读用的 JSZip 会把整包读进内存，不适用。
- iOS：ZIPFoundation（ZIP，按条目读取，支持 ZIP64）、libarchive（RAR4/RAR5、7Z、TAR）、ImageIO 降采样、LocalAuthentication。
- 安卓：自写只读中央目录解析（含 ZIP64，拿文件名原始字节）、libarchive（JNI，替换微光阅读里只支持 RAR4 的 junrar）、BitmapFactory `inSampleSize` 降采样。
- **原生层只读文件、解码、算哈希；文件名解码、排序、分类等规则全部放在 TS 纯逻辑里**，用 Vitest 测。
- 数据库（Dexie）只存记录；漫画副本在 App 私有目录，封面和页面缓存在缓存目录（页面缓存上限 500 MB，按最近使用淘汰）。
- 内容指纹：`sha256(文件大小 + 前 1 MB + 后 1 MB)`；图片文件夹用排序后的相对路径加大小。用于去重和备份恢复匹配。

### 3.1 Dexie 表（v1）

```ts
books: '&id, fingerprint, seriesId, lastReadAt, importedAt, sortKey';
series: '&id, sortKey, updatedAt';
pageLists: '&bookId';
progress: '&bookId, updatedAt';
bookmarks: '&id, bookId, createdAt';
imports: '&id, state';
settings: '&key';
pendingMatches: '&fingerprint'; // 备份里还没对上文件的记录
```

Book 主要字段：id、fingerprint、title、seriesId、volume、chapter、sortKey、format（zip/rar/7z/tar/folder/pdf/epub）、location（copy 或 inplace）、sizeBytes、pageCount、coverPage、nameEncoding、direction（ltr/rtl/null）、mode（paged/scroll/null）、spreadOffset、cropBorders、status、importedAt、lastReadAt、meta（ComicInfo）。Progress 为 `{bookId, page, offset(0–1), updatedAt}`。

### 3.2 原生插件接口（iOS 与安卓实现同一套）

```ts
interface ComicArchivePlugin {
  inspect(o: { path: string }): Promise<{
    format: 'zip' | 'rar' | '7z' | 'tar';
    encrypted: boolean;
    entries: Array<{
      index: number;
      name?: string;
      rawName?: string /* base64，无 UTF-8 标志时 */;
      size: number;
    }>;
  }>;
  renderPage(o: {
    bookId: string;
    path: string;
    entry: number;
    maxPixel: number;
    crop?: boolean;
  }): Promise<{
    url: string;
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
  }>;
  thumbnail(o: {
    bookId: string;
    path: string;
    entry: number;
  }): Promise<{ url: string }>;
  fingerprint(o: { path: string }): Promise<{ sha256: string; size: number }>;
  contentBounds(o: {
    path: string;
    entry: number;
  }): Promise<{ x: number; y: number; w: number; h: number } | null>;
  clearCache(o: { bookId?: string }): Promise<void>;
}
interface ImportPlugin {
  pickFiles(): Promise<{ items: PickedItem[] }>;
  pickFolder(): Promise<{ items: PickedItem[] }>;
  copyToLibrary(o: {
    jobId: string;
    item: PickedItem;
    bookId: string;
  }): Promise<{ path: string }>;
  cancel(o: { jobId: string }): Promise<void>;
  // 事件：'incoming'（分享/用…打开）、'progress'
}
type PickedItem = {
  uri: string;
  name: string;
  size: number;
  isDirectory: boolean;
  relativePath?: string;
};
interface AppLockPlugin {
  availability(): Promise<{
    biometry: 'faceId' | 'touchId' | 'fingerprint' | 'none';
    passcode: boolean;
  }>;
  authenticate(o: { reason: string }): Promise<{ ok: boolean }>;
  setPrivacyCover(o: { enabled: boolean }): Promise<void>;
}
```

Pro：复用微光阅读 `ios/App/App/ProStore.swift`（StoreKit 2），换商品标识，对 TS 暴露 `status / purchase / restore`。

### 3.3 可以从微光阅读（`D:\电子书阅读器`）复制的

`src/app/theme.ts`、`themePreference.ts`、`router.ts`、`useBackClose.ts`；`src/components/Modal.tsx`、`Icon.tsx`、`LanguageSelector.tsx`、`virtualRange.ts`、`ProPanel.tsx`（参照）；`src/db/schema.ts` 的迁移写法；`src/backup` 的格式与校验思路；`ios/App/App/JyDocumentsPlugin.swift` 中的 `contentBounds`（移植给自动裁白边）；`android/.../NativeBookArchive.java` 的路径安全检查。

## 4. 任务清单（M0–M4，估时为人日）

完成标准：类型检查与构建通过；纯逻辑有 Vitest；卡片验收项有结论；代码实现、自动检查、真机验收分开记录。

| 编号     | 任务                                                                                                | 估时 | 状态                                     |
| -------- | --------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------- |
| M0-01    | 竞品差评整理                                                                                        | 2    | 完成                                     |
| M0-02    | 关键词热度                                                                                          | 0.5  | 完成（Search Ads 热度待用户补查）        |
| M0-03    | 测试素材脚本 `scripts/make_test_books.py`                                                           | 1    | 完成（RAR 缺 WinRAR；4 GB 包需 `--big`） |
| M0-04    | 新工程初始化                                                                                        | 1    | 基本完成，见第 5 节                      |
| M0-05    | iOS 性能原型：ZIPFoundation 读 4 GB ZIP，ImageIO 降采样写缓存，WebView 加载本地地址，最简翻页与条漫 | 3    | 未开始，需 Mac（B1 批次）                |
| M0-06    | 安卓性能原型：中央目录解析 + BitmapFactory 降采样；评估 libarchive 的 RAR5 与包体积                 | 1.5  | 未开始，**Windows 可做，建议下一步**     |
| M0-07    | 闸门一评审：差评条件已通过，等性能原型数值                                                          | 0.5  | 未开始                                   |
| M1-01    | Dexie 表与迁移                                                                                      | 1    |                                          |
| M1-02    | ComicArchive 插件 v1（ZIP，两端）                                                                   | 2    |                                          |
| M1-03    | 导入流程（IM-01–03）                                                                                | 2    |                                          |
| M1-04    | 文件夹分类与重复检测（IM-04、IM-06）                                                                | 1.5  |                                          |
| M1-05    | 书架与继续阅读（LB-01、LB-04、PG-02）                                                               | 2    |                                          |
| M1-06    | 阅读器骨架与横向翻页（RD-01、RD-06、RD-09）                                                         | 2.5  |                                          |
| M1-07    | 条漫模式（RD-02）                                                                                   | 2    |                                          |
| M1-08    | 进度保存与恢复（PG-01）                                                                             | 1    |                                          |
| M1-09    | B2 批次：Mac 构建与真机验收                                                                         | 1    |                                          |
| M2-01    | 双页配对与跨页（RD-03、RD-04）                                                                      | 1.5  |                                          |
| M2-02    | 缩放（RD-05）                                                                                       | 1.5  |                                          |
| M2-03    | 跳页与自动接续（RD-07、RD-08）                                                                      | 1    |                                          |
| M2-04    | RAR（libarchive，两端）；7Z/TAR 在 P1 弹性池                                                        | 2.5  |                                          |
| M2-05    | 文件名编码识别（IM-05）                                                                             | 1    |                                          |
| M2-06    | 系列归组与自然排序（LB-02、LB-03）                                                                  | 2    |                                          |
| M2-07    | 轻量备份与恢复匹配（BK-01、BK-02）                                                                  | 2    |                                          |
| M2-08    | 设置、存储管理、关于与隐私                                                                          | 1.5  |                                          |
| M2-09    | 漫画 EPUB（固定版式，按 spine 取图）                                                                | 1    |                                          |
| M2-10    | B3 批次                                                                                             | 1    |                                          |
| M3-01    | StoreKit 接入                                                                                       | 1    |                                          |
| M3-02    | 购买页与 Pro 预览（不弹窗）                                                                         | 1    |                                          |
| M3-03    | 自动裁白边（RD-10，Pro）                                                                            | 2    |                                          |
| M3-04    | 应用锁与隐藏系列（LB-08，Pro）                                                                      | 1.5  |                                          |
| M3-05    | 性能冲刺（见第 6 节指标）                                                                           | 2    |                                          |
| M3-06    | 无障碍                                                                                              | 1    |                                          |
| M3-08    | 中英文界面                                                                                          | 0.5  |                                          |
| M3-07    | B4 批次：沙盒内购、Face ID、性能实测                                                                | 1    |                                          |
| M4-01–07 | 验收清单、B5 真机验收、修复缓冲 3 天、零网络核查、商店素材（简繁英三套）、支持站、提交审核          | 9.5  |                                          |

闸门一：至少两个切入点在差评里反复出现（已通过）+ iOS 性能原型达标。闸门二：全部 P0 真机通过 + 性能指标全部达标。P1 弹性池（有空才做，顺序）：书签、夜间降亮、手动改名换封面、ComicInfo、书架搜索、iPad 拖放、繁体中文界面（M0-02 显示台区几乎没有对手，有空先做）、原位阅读、批量整理、PDF、7Z/TAR。

## 5. 当前工程状态

- 已有：Vite 8 + Preact + TS strict + Signals + ESLint + Prettier + Vitest 配置；`capacitor.config.ts`（appId `dev.weiguang.comic`）；空书架页（`src/pages/Shelf.tsx`）、中英文框架（`src/i18n`）、跟随系统深浅色；`tokens.css` 从微光阅读复制。
- `pnpm build` 通过（gzip 9.5 KB）。lint 与 Vitest 未跑（按约定）。
- 安卓：已 `cap add android`；`AndroidManifest.xml` 用 `tools:node="remove"` 移除 INTERNET；`gradle.properties` 加了 `android.overridePathCheck=true`（路径含中文）；`android/local.properties` 指向 `D:/Android/Sdk`。
- **调试包已构建成功**（2026-10-29）：`android/app/build/outputs/apk/debug/app-debug.apk`，约 4.1 MB；合并后的清单里没有 INTERNET 权限。还没装到真机验证。本机全局 Gradle 缓存（`C:\Users\a1382\.gradle\caches\8.14.3`）大面积损坏，所以用项目独立缓存构建：

  ```bash
  cd android
  JAVA_HOME="D:/Android/jdk/jdk-21.0.12.1+1" GRADLE_USER_HOME="D:/微光漫画/.gradle-home" ./gradlew assembleDebug --no-daemon
  ```

  首次下载依赖用了约 28 分钟，之后增量构建约 30 秒。

- iOS 工程未生成，需在 Mac 上 `npx cap add ios`（最低 iOS 15），放到 B1 批次。
- 图标为 Capacitor 默认占位。
- git 已 `init`，**尚未提交**；用户验收 M0-04 后按 `M0-04: 初始化工程` 提交，未配置作者时不伪造身份。

## 6. 性能指标（基准：iPhone 12、iPad 第 9 代、安卓 6 GB 中端机）

冷启动到书架 ≤ 1.5 秒；打开已导入的书到第一页 ≤ 1 秒（4 GB 包也一样）；翻到已预加载的页 ≤ 100 毫秒；条漫 60 fps；导入 1 GB ZIP ≤ 60 秒；iPhone 阅读内存 ≤ 400 MB，长条漫不闪退；封面生成不阻塞阅读。

## 7. 测试素材

`pnpm test-books`（Python 3 + Pillow）生成到 `test-books/`（已忽略），每组的检查点和期望顺序在 `test-books/MANIFEST.json`。包括：GBK/Big5/Shift_JIS 文件名 ZIP、中文数字话数文件夹、30 张 800×20000 条漫、缺封面含跨页的日漫卷（ComicInfo 从右往左）、跨页文件名排序、损坏页、WebP 加垃圾文件、嵌套合集、固定版式 EPUB、5000 本模拟书架。RAR 需安装 WinRAR 后重跑；`--big` 生成 4 GB、2000 页大包。

## 8. 建议的下一步

1. 把调试包装到安卓真机，确认能打开空书架（M0-04 的最后一项，需要用户操作）。
2. M0-06 安卓性能原型（可在 Windows 上完成）：Capacitor 插件读 `large-200p.zip` 和 `--big` 大包，按条目随机读取、降采样写缓存、WebView 显示；记录打开时间、内存峰值、条漫帧率；评估 libarchive 的 RAR5 支持和安装包增量。结果写进 `DEVELOPMENT_STATUS.md`。
3. M0-05 写好 iOS 原型代码与 Mac 交接提示词，等 B1 批次。
