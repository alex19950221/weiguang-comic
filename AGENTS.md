# 微光漫画工程规范

## 执行方式

- 始终使用用户在应用中选择的主模型与推理强度，单代理端到端执行；不创建子代理，不自动切换模型。
- 保留用户修改，验证力度与风险相称，不进行无关重构。
- 会话压缩后先恢复最新未完成任务、约束、进度与下一步；以 DEVELOPMENT_STATUS.md 作为项目检查点。

## 产品与技术

- 开发前阅读 CODEX_HANDOFF.md、PRD 与开发计划（链接见 README.md）和 DEVELOPMENT_STATUS.md。
- 只读用户自己的文件：不内置、不推荐、不搜索任何漫画资源；不支持第三方书源；不处理 DRM；不改用户原文件。
- 无注册、无追踪、无广告、无 AI；不发任何网络请求，安卓不申请网络权限。例外必须先写进 PRD。
- 已公开免费的功能不改为付费；Pro 为一次买断（StoreKit 非消耗型 `dev.weiguang.comic.pro`），购买页只在用户主动打开时出现。
- 技术栈：Vite、Preact、TypeScript strict、Preact Signals、Capacitor；压缩包读取与大图降采样放在原生层，WebView 只拿缩小后的页面。
- 新依赖必须说明理由及体积；原生库记录安装包增量。
- UI 在 src/pages 与 src/components；应用状态在 src/app；阅读器在 src/reader；书架整理在 src/library；包内内容处理在 src/archive；存储在 src/db；线程在 src/workers；备份在 src/backup；原生插件封装在 src/native；主题在 src/styles。
- 使用语义 HTML、系统字体、移动端布局与不少于 44px 的交互热区。
- TypeScript 严格类型，不用 any 绕过问题；Prettier 统一格式。
- 文件名解码、自然排序、系列识别、双页配对、进度定位、备份合并等纯逻辑写 Vitest 测试。

## 命令与交付

- pnpm dev：本地开发；pnpm build：类型检查及生产构建；pnpm build:android / build:ios：构建并同步原生工程。
- pnpm lint、pnpm test：默认不跑；闸门一、闸门二和提交审核前各跑一次全部 Vitest。
- pnpm test-books：生成测试素材到 test-books/（已忽略，不入库）。
- 代码实现、自动检查、真机验收分别记录；构建成功不写成真机验收通过，未测项明确列出。
- main 保持可运行，阶段分支 m0–m4；验收后按任务编号提交，如 `M1-03: 导入流程`。未配置作者时不伪造身份。
- 不提交 node_modules、dist、私钥、真实用户数据或有版权的漫画。
