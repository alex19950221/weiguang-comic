# M1-04：数据库 v2、系列入库与用户分组

更新：2026-10-30。本文记录 M1-04 数据层首轮；后续 M1-05 已接入书架分组界面和原生删除接口，见 [SHELF_M1.md](./SHELF_M1.md)。原生验收仍未完成。

## 版本与字段

`schemaV1` 原文保留，新增 `version(2).stores(schemaV2).upgrade(upgradeToV2)`，不删除或重建用户数据库。新安装直接创建 v2，并保持原有默认设置；重开不会覆盖设置。遇到未来版本仍拒绝打开并保留原库。

| 对象            | v2 改动                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `books`         | 新增 `fileName: string \| null`、`unit: '卷' \| '话'`；使用现有 `seriesId`、`volume`、`chapter`。索引不变                                      |
| `series`        | 新增唯一 `key`、`groupId`、`favoritedAt`；索引为 `&id, &key, groupId, favoritedAt, sortKey, updatedAt`                                         |
| `imports`       | 原有字段不变，增加 `bookId` 索引                                                                                                               |
| `libraryGroups` | 新表：`id, name, nameKey, order, createdAt, updatedAt`；索引为 `&id, &nameKey, order, updatedAt`                                               |
| `fileCleanup`   | 仅预留表与类型：`bookId, location, state, attempts, error, createdAt, updatedAt`；索引为 `&bookId, state, updatedAt`。本轮不排任务、不删除文件 |

其余 `pageLists / progress / bookmarks / settings / pendingMatches` 表结构不变，共十张表。旧备份中嵌入的书目允许缺少 `fileName / unit`，不在升级中改写待匹配备份。

## v1 升级规则

- 仅在 Dexie 的升级事务内读写元数据，不调用原生文件接口。
- 原文件名取该书最新的 `done` 导入记录；没有来源则留 `null`，不使用 UUID 私有路径猜测。
- 使用 `parseComicName` 识别系列名与卷/话号；已有书名、非空卷/话号和有效人工系列关系优先保留。已有话号且没有卷号时单位为“话”。
- 使用 `seriesKey` 归并同名系列；同键旧系列保留最早创建记录的 ID 和名称，保留隐藏状态、最早创建时间与最新更新时间，重定向书目关系。空系列保留。
- 无法产生比较键的名称用稳定 ID 隔离，防止全标点名称误合并；新系列 ID 避开旧 ID。
- 书籍 ID、路径、指纹、进度、书签、页目录、设置、导入记录、待匹配备份不丢失；任一步失败整体回滚。后续打开 v2 不重跑回填。

## 正式导入

沿用原生复制、目录检查和指纹计算。指纹查重通过后，在同一 `books + series + pageLists + imports` 事务内：

1. 解析原文件名，按唯一系列键复用或新建系列。
2. 写入解析后的书名、原文件名、单位、系列 ID；卷号写入 `volume`，话号写入 `chapter`。
3. 保存页目录与完成状态。后续卷保留系列的分组、收藏和隐藏属性。

重复导入不创建孤立系列；保存失败时新系列或已有系列的更新时间也回滚。`ensureSeries` 可独立调用，也可嵌入包含 `series` 表的上层事务。

## 分组为什么用独立表

分组有稳定 ID、唯一名称、顺序和改名生命周期。独立表能用唯一索引避免并发创建同名项，并让“删除分组、系列回到未分组”共用事务；放进单个 settings 对象会增加整块读写和并发覆盖风险。

归属保存在 `series.groupId`，同系列所有卷共享分组；`null` 表示未分组，不创建特殊的“未分组”记录。收藏同样保存在系列级 `favoritedAt`。

| API（`src/library/groups.ts`）             | 行为                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `createLibraryGroup(db, name)`             | 去除多余空白、最多 20 个 UTF-16 单元（与原型 `maxLength` 一致）；名称键忽略全半角和大小写，同名返回已有项，新组排在末尾 |
| `renameLibraryGroup(db, id, name)`         | 保留 ID、顺序和创建时间，拒绝与其他组重名                                                                               |
| `moveSeriesToGroup(db, seriesId, groupId)` | 事务内检查系列和分组存在；传 `null` 移回未分组                                                                          |
| `deleteLibraryGroup(db, id)`               | 事务内将系列移回未分组，再删除分组；不删除书籍、进度、书签或文件；重复调用安全                                          |

存储层以 `GroupError.code` 返回稳定错误码，正式 UI 接入时映射到 `src/i18n` 中英条目。

## 验证与下一步

- 新增 22 个 Vitest：升级 9、分组 9、导入 4；并更新数据库 3 个及导入原有用例的断言。目前共 70 个用例。按约定本轮未运行 lint / Vitest，不能将其记为测试通过。
- `pnpm build`、`pnpm build:ios`、`pnpm check:ios --release`、`pnpm build:prototype` 均通过。release 检查新增交互原型入口、Demo 模块文件名和演示存储键检查。
- 浏览器独立临时库完成 12 项核对：真实 IndexedDB 升级、旧数据保留、系列合并、分组去重/改名/移动/重开、删组回滚与保留书籍、导入并组/重复/失败回滚。导入的原生接口使用替身；临时库与页面已清理。
- 正式构建桌面 1280×720 与手机 375×812：空书架正常，导入按钮 44px；缺少原生接口时禁用；无横向溢出和控制台错误。
- Swift 编译、XCTest、iOS 旧库升级与跨进程持久化、真实导入、中断清理、翻页性能、捏合手势及 iPad 实机均未验收。

下一步 M1-05：按已确认原型实现正式书架，接入本文件的系列和分组 API；补原生封面接口与安全删除接口，使用 `fileCleanup` 实现失败可重试的副本清理。压缩包和大图仍在原生层处理，不能导入原型数据或 Demo 组件。
