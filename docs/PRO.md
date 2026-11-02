# 微光 Pro（M3-01/02）

依据 PRD 第 8 节（2026-11-02 确认）。

## 定价与范围

- 一次买断，StoreKit 非消耗型商品 `dev.weiguang.comic.pro`；国区 ¥20，其他地区取对应档位（美区建议 US$2.99）；开启家人共享。不订阅、无广告、无计时试用。
- 自定义分组永久免费。阅读、全部格式、进度/书签/备份等数据安全功能永久免费。
- 版本节奏：1.0 自动裁白边、应用锁与隐藏系列；1.1 原位阅读、批量整理；1.2 自动翻页、画面滤镜。买断用户后续功能免费获得。
- 至少交付两项 Pro 功能才开放购买（`purchaseOpen`）。功能交付后在 `src/app/proPolicy.ts` 把对应 `delivered` 改为 true。

## 实现

| 位置                                                       | 作用                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ios/ComicNative/Sources/ComicNative/ProStorePlugin.swift` | StoreKit 2：`status({product})`、`purchase()`、`restore()`，监听 `Transaction.updates` 并发出 `change`。权益来自系统缓存的 `currentEntitlements`，离线可判断；不保存账号或凭证。系统框架，无新依赖。 |
| `src/native/proStore.ts`                                   | 插件类型与注册；浏览器/安卓无插件时 `supportsPro()` 为 false。                                                                                                                                       |
| `src/app/proPolicy.ts`                                     | 纯逻辑：功能清单、开放购买门槛、入口可见性、`requiresPro`/`canPerform`。只有“新增”类操作需要 Pro；关闭、解锁、取消隐藏、读取已有原位书等永远可用（失去权益不丢数据）。                               |
| `src/app/pro.ts`                                           | Pro 状态（signal）：读取、购买、恢复、原生变化订阅；可注入替身测试。                                                                                                                                 |
| `src/components/ProDialog.tsx`                             | 购买页，只在用户从设置点「查看」时出现；列已交付功能与“后续更新，买断用户免费获得”。                                                                                                                 |

入口规则：正式商店在开放购买前不显示「微光 Pro」设置行；Debug 与 TestFlight（沙盒收据）始终显示，并允许“测试环境”购买，用于验证流程。

## 需要在 App Store Connect 完成（用户操作）

1. 签署并生效「付费 App 协议」，填好银行与税务信息。
2. App 内购买项目 → 新建「非消耗型」，产品 ID `dev.weiguang.comic.pro`，参考名称 LumiComic Pro，价格选 ¥20 档，开启家人共享，填写简中/英文显示名称与描述、审核截图（购买页）。
3. 首次提交时把该内购项目与 App 版本一同提交审核（开放购买前不需要）。

## 测试

- 模拟器离线测试：Xcode → Edit Scheme → Run → Options → StoreKit Configuration 选 `ios/App/LumiComicPro.storekit`，即可购买、退款、询问购买（Debug → StoreKit → Manage Transactions）。
- TestFlight：用沙盒 Apple 账户购买/恢复；需要上一节的内购项目已创建。
- 验收要点：购买后设置显示“已解锁”；恢复购买；退款（Manage Transactions → Refund）后回到免费且书架数据不变；家人共享；询问购买显示等待批准。
