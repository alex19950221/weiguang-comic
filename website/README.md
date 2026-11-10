# 微光漫画官网（支持与法律页面）

线上地址：https://comic.spineapps.com/ （Cloudflare Pages 项目 `lumicomic-support`，生产分支 `main`；DNSPod `comic` CNAME 到 `lumicomic-support.pages.dev`）。

中英文各 4 页：主页、技术支持、隐私政策、用户协议。隐私政策和技术支持页对应 App Store Connect 的「隐私政策网址」「技术支持网址」。纯静态页面，没有运行时 JavaScript、表单、第三方字体或统计脚本。

| 文件 | 作用 |
| --- | --- |
| `build.py` | 生成脚本，只用 Python 标准库 |
| `content-lumicomic.json` | 页面正文、开发者、联系邮箱、正式域名、更新日期 |
| `site.css` / `comic.css` | 基础样式 / 漫画风叠加样式 |
| `lumicomic-icon.png` | 站点图标（占位图，尚未换成正式 App 图标） |
| `public/` | 生成结果，即部署内容 |
| `deployment-lumicomic.json` | 最近一次部署记录（2026-10-30） |

```bash
python website/build.py
wrangler pages deploy website/public --project-name lumicomic-support --branch main --commit-dirty=true
```

## 来源

2026-11-10 从 `D:\电子书阅读器\website\spineapps\` 迁入。原脚本同时生成微光阅读（LumiRead）支持站，这里只保留微光漫画部分，输出目录由 `public-lumicomic/` 改为 `public/`。迁入后重新生成的 14 个文件与 2026-10-30 线上部署的本地产物逐字节一致。本次未重新部署。

`deployment-lumicomic.json` 里的 `verificationReport` 指向原目录下的核对记录，没有一起迁入。

## 待办

- App 已于 M3-05 更名为「微光漫卷」，官网仍写「微光漫画 / LumiComic」，需要另行更新文案并重新部署。
- 图标仍是占位图。
