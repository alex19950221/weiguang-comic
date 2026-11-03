# 微光漫卷-离线图片阅读器

中文桌面与应用内显示名为「微光漫卷」，全名为「微光漫卷-离线图片阅读器」；英文桌面名为 LumiComic。

只读你自己文件的本地漫画阅读器：导入 CBZ、ZIP、RAR 或整个图片文件夹，按系列自动排好，不联网、不登录、不内置任何漫画来源。

- 产品需求：[PRD](https://claude.ai/artifact/7e8vaUFGU7Com28mQL5ZwR)
- 开发计划：[开发计划](https://claude.ai/artifact/SUz5GAJMqLQvZcULVB6Va5)
- 调研：[M0-01 竞品差评分析](https://claude.ai/artifact/X2FJVYsstAeZUhYb2sNF7t)、[M0-02 关键词调研](https://claude.ai/artifact/DQLkkYG5MCLfMVLFq34coc)
- 进度检查点：[DEVELOPMENT_STATUS.md](./DEVELOPMENT_STATUS.md)
- 交接说明：[CODEX_HANDOFF.md](./CODEX_HANDOFF.md)
- iOS 原型构建与验收：[B1 操作说明](./docs/IOS_B1.md)
- 正式 ZIP/CBZ 导入范围与验收：[M1 导入说明](./docs/IMPORT_M1.md)
- 正式书架与原生封面/删除：[M1-05 说明](./docs/SHELF_M1.md)
- 正式阅读器与进度：[阅读、目录、书签与进度](./docs/READING_M1.md)
- 微光 Pro 范围、内购实现与测试：[Pro 说明](./docs/PRO.md)
- 浏览器交互原型：[书架与阅读器体验说明](./docs/UI_PROTOTYPE.md)

## 开发

想先看整体效果：运行 `pnpm build:prototype`、`pnpm preview:prototype`，打开 `http://127.0.0.1:4180/prototype.html`。这是独立的书架/阅读器交互原型，不使用正式书架数据；开发时用 `pnpm dev:prototype`。

```bash
pnpm install
pnpm dev
```

`pnpm build` 做类型检查与生产构建；`pnpm build:android` 构建并同步安卓工程。

`pnpm build:ios` 构建并同步 iOS 正式网页；`pnpm build:ios:prototype` 同步 M0 性能原型，配合 Xcode Debug 构建使用。`pnpm check:ios` 检查原生工程连接与离线配置。Swift 编译、签名与真机验收需在 Mac 上执行。

测试素材由 `pnpm test-books` 生成（需要 Python 3 与 Pillow；RAR 样本需要 WinRAR 命令行，加 `--big` 生成 4 GB 大包）。
