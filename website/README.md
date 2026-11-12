# 微光漫画官网（支持与法律页面）

线上地址：https://comic.spineapps.com/ （Cloudflare Pages 项目 `lumicomic-support`，生产分支 `main`；DNSPod `comic` CNAME 到 `lumicomic-support.pages.dev`）。

中英文各 4 页：主页、技术支持、隐私政策、用户协议。隐私政策和技术支持页对应 App Store Connect 的「隐私政策网址」「技术支持网址」。纯静态页面，没有运行时 JavaScript、表单、第三方字体或统计脚本。

| 文件 | 作用 |
| --- | --- |
| `build.py` | 生成脚本，只用 Python 标准库 |
| `content-lumicomic.json` | 页面正文、开发者、联系邮箱、正式域名、更新日期 |
| `site.css` / `comic.css` | 基础样式 / 漫画风叠加样式 |
| `lumicomic-icon.png` | 站点图标，由正式 App 图标 `AppIcon-512@2x.png` 缩到 288px |
| `public/` | 生成结果，即部署内容 |
| `deployment-lumicomic.json` | 最近一次部署记录 |

```bash
python website/build.py
wrangler pages deploy website/public --project-name lumicomic-support --branch main --commit-dirty=true
```

## 来源

2026-11-10 从 `D:\电子书阅读器\website\spineapps\` 迁入。原脚本同时生成微光阅读（LumiRead）支持站，这里只保留微光漫画部分，输出目录由 `public-lumicomic/` 改为 `public/`。迁入后重新生成的 14 个文件与 2026-10-30 线上部署的本地产物逐字节一致。本次未重新部署。

10-30 那次部署的逐页核对记录留在原目录 `D:\电子书阅读器\artifacts\`，没有迁入。

## 2026-11-10 更名与正式图标

中文名称改为「微光漫卷」，与 M3-05 的 App 更名一致；英文名称仍为 LumiComic。站点图标换成正式 App 图标。正文更新日期改为 2026-11-10。已于同日部署（`https://dadb759b.lumicomic-support.pages.dev`），正式域名 13 个文件与 `public/` 逐字节一致。

## 2026-11-10 与 1.0（构建 11）对齐

- 格式：首页、技术支持、用户协议改为 1.0 实际支持的 ZIP、CBZ、PDF 和图片漫画 EPUB，并写明暂不支持 RAR/CBR、图片文件夹导入、分享/「用…打开」导入（依据 `docs/APP_STORE_SUBMISSION.md`）。
- 功能：去掉轻量备份与恢复、存储管理、「错开一页」、长条图提示等 1.0 没有的说法；补上 Pro 的 6 项功能和原位阅读。
- 隐私政策：中间 4 节直接取自 `src/app/privacyPolicy.ts`（App 内与 `docs/PRIVACY_POLICY.md` 同源），网站额外保留开发者邮箱、邮件联系和支持网站 3 处说明。以后 App 隐私政策改了，这里要同步。
- `build.py` 的正文段落支持多段（列表）。

## 原创审核样例

`art/make_sample.py` 用 AppKit 自绘四页原创漫画《雾岛来信》，打包为 `art/out/fog-island.cbz`（已忽略，不进入 `public/`）。在仓库根目录运行 `python3 website/art/make_sample.py`。
