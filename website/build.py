"""Generate the LumiComic product, support and legal site; Python standard library only.

Product home page, support, privacy and terms in Chinese and English, deployed to Cloudflare Pages
(project lumicomic-support, custom domain comic.spineapps.com).
Usage: python website/build.py [output root]   (default: this folder; writes ./public)
"""
from datetime import date
from html import escape
from pathlib import Path
import json
import shutil
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
OUT_ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT

APPS = [
    {
        "slug": "lumicomic",
        "out": "public",
        "base": "/",
        "content": "content-lumicomic.json",
        "icon": "lumicomic-icon.png",
        "extra_css": "comic.css",
        "eyebrow": "LUMICOMIC",
        "words": {
            "zh": {"name":"微光漫卷", "lang":"zh-Hans", "other":"English", "skip":"跳到正文", "toc":"本页内容", "home":"支持与说明", "updated":"更新及生效日期", "contact":"联系开发者", "end":"如需咨询此页面内容，请联系", "footer":"本地漫画 · 无需账户 · 不收集数据", "alt":"LUMICOMIC"},
            "en": {"name":"LumiComic", "lang":"en", "other":"简体中文", "skip":"Skip to content", "toc":"On this page", "home":"Support & information", "updated":"Last updated and effective", "contact":"Contact the developer", "end":"Questions about this page? Contact", "footer":"Local comics · No account · No data collected", "alt":"微光漫卷"},
        },
        "store": "https://apps.apple.com/cn/app/id6829142764",
        # 安卓 APK 不入库：从已忽略的 release/android/ 复制到 public/download/（同样忽略）。
        "apk": {"src": "../release/android/LumiComic-1.0.0-android.apk", "file": "lumicomic-1.0.0-android.apk", "version": "1.0.0"},
        "home": {
            "zh": {
                "title":"本地漫画阅读器",
                "kicker":"本地漫画阅读器 · iPhone / iPad",
                "headline":"安静地，<br>看完一整卷。",
                "intro":"微光漫卷只读你自己的漫画文件。导入 ZIP、CBZ、PDF 或图片漫画 EPUB，系列自动按卷、话排好。不联网、不登录、没有广告，漫画只留在你的设备上。",
                "store":"在 App Store 下载", "store_note":"免费下载 · iOS 15 及以上",
                "android":"安卓版", "android_note":"测试版下载",
                "facts":["不联网","无需注册","不收集数据","一次买断"],
                "shot_alt":"微光漫卷单页阅读界面",
                "features_title":"把注意力还给画面",
                "features":[
                    ["导入就排好","从「文件」一次多选导入，自动识别系列、卷与话，按自然顺序排列。重复文件自动跳过，原文件不会被修改。"],
                    ["单页、双页、条漫","三种模式随时切换，支持从右向左翻页，会读取漫画包里的日漫方向标记。"],
                    ["读到哪都记得","自动保存进度；书签、目录和缩略图快速跳页，读完一卷直接打开下一卷。"],
                    ["不抢戏的背景","自动、纯白、纯黑三种阅读背景，配合亮度调节与全屏沉浸。"],
                    ["完全离线","App 不发任何网络请求。没有账号、广告、统计或第三方 SDK。"],
                    ["一次买断，不订阅","阅读功能永久免费。Pro 一次购买，之后加入的 Pro 功能免费获得，支持家人共享。"],
                ],
                "gallery_title":"看看它的样子",
                "gallery":[["phone-library.jpg","书架：系列、分组与筛选"],["phone-reader.jpg","单页阅读"],["phone-contents.jpg","目录与缩略图跳页"]],
                "ipad":["ipad-spread.jpg","iPad 双页阅读"],
                "sample_note":"截图中的漫画《雾岛来信》为原创示例。微光漫卷不提供任何漫画内容。",
                "plans_title":"免费的够用，Pro 更顺手",
                "free_title":"永久免费", "free":["全部支持格式的导入与阅读","单页、双页、条漫，从右向左翻页","系列整理、分组、收藏与搜索","进度、书签、目录与缩略图","自动 / 纯白 / 纯黑背景，中英文界面"],
                "pro_title":"微光 Pro · 一次买断", "pro":["自动裁白边：去掉扫描版四周的白边和黑边","应用锁与隐藏系列：面容 ID 或密码进入","原位阅读：直接读「文件」中的原件，不再复制","批量整理：多选后移入分组、标记已读或删除","自动翻页：按间隔翻页，条漫匀速滚动","画面滤镜：调节对比度、锐化与暖色"],
                "plans_note":"公开上架时免费的功能，以后不会改为付费，也不会加次数限制。",
                "platforms_title":"在哪里用",
                "ios_title":"iPhone 与 iPad", "ios_status":"已上架", "ios_text":"在 App Store 搜索「微光漫卷」，或点下面的按钮。需要 iOS 15 或更高版本，iPad 支持横屏双页。",
                "android_title":"Android", "android_status":"测试版", "android_text":"首个离线测试版：支持 ZIP/CBZ、PDF 和图片 EPUB 的导入与阅读，同样不申请网络权限。需要 Android 7.0 或更高版本。Pro 暂未在安卓提供。", "apk_button":"下载安卓测试版", "apk_note":"APK", "apk_help":"安装时系统会询问是否允许浏览器或文件管理器「安装未知应用」，允许后即可安装。这是测试签名的版本：以后正式版发布时需要先卸载再安装，卸载会清空书架和阅读进度，请保留原文件。",
                "help_title":"支持与说明",
            },
            "en": {
                "title":"Local comic reader",
                "kicker":"Local comic reader · iPhone / iPad",
                "headline":"Quiet pages.<br>Whole volumes.",
                "intro":"LumiComic only opens your own comic files. Import ZIP, CBZ, PDF or image-based EPUB comics and your series are sorted by volume and chapter. Offline, no account, no ads: your comics stay on your device.",
                "store":"Download on the App Store", "store_note":"Free · iOS 15 or later",
                "android":"Android", "android_note":"Download test build",
                "facts":["Offline","No account","No data collected","One-time purchase"],
                "shot_alt":"LumiComic single-page reader",
                "features_title":"Let the pages take the stage",
                "features":[
                    ["Sorted on import","Pick several files from Files at once. Series, volumes and chapters are detected and put in natural order. Duplicates are skipped and originals are never modified."],
                    ["Single, Spread, Scroll","Switch modes any time, read right to left, and manga direction tags inside the archive are honoured."],
                    ["Picks up where you left off","Progress saves automatically. Bookmarks, contents and thumbnails for quick jumps; finish a volume and open the next."],
                    ["Backgrounds that stay out of the way","Auto, white or black reader backgrounds, with brightness control and full-screen reading."],
                    ["Fully offline","The app makes no network requests. No account, ads, analytics or third-party SDKs."],
                    ["Buy once, no subscription","Reading is free forever. Pro is a single purchase; later Pro features are included, with Family Sharing."],
                ],
                "gallery_title":"A closer look",
                "gallery":[["phone-library.jpg","Library: series, groups and filters"],["phone-reader.jpg","Single-page reading"],["phone-contents.jpg","Contents and thumbnails"]],
                "ipad":["ipad-spread.jpg","Two-page spread on iPad"],
                "sample_note":"The comic in these screenshots, Letters from Fog Island, is an original sample. LumiComic does not provide any comic content.",
                "plans_title":"Free is plenty. Pro is smoother.",
                "free_title":"Free forever", "free":["Import and read every supported format","Single, Spread and Scroll, right-to-left reading","Series, groups, favourites and search","Progress, bookmarks, contents and thumbnails","Auto / white / black backgrounds, Chinese and English"],
                "pro_title":"LumiComic Pro · one-time purchase", "pro":["Auto-crop: trims white and black margins from scans","App Lock and hidden series with Face ID or passcode","Read in place: open originals in Files without copying","Batch organising: group, mark read or delete in one go","Auto page turning and smooth scroll","Image filters: contrast, sharpening and warmth"],
                "plans_note":"Features that are free at public launch will never become paid or limited.",
                "platforms_title":"Where to read",
                "ios_title":"iPhone and iPad", "ios_status":"Available", "ios_text":"Search for LumiComic on the App Store or use the button below. Requires iOS 15 or later; iPad supports two-page spreads in landscape.",
                "android_title":"Android", "android_status":"Test build", "android_text":"The first offline test build imports and reads ZIP/CBZ, PDF and image EPUB, with no network permission. Requires Android 7.0 or later. Pro is not yet available on Android.", "apk_button":"Download Android test build", "apk_note":"APK", "apk_help":"When installing, Android asks whether your browser or file manager may install unknown apps; allow it to continue. This build uses a test signature: when the official version ships you will need to uninstall it first, which clears your library and reading progress, so keep your original files.",
                "help_title":"Support and information",
            },
        },
    },
]


def load(app):
    data = json.loads((ROOT / app["content"]).read_text(encoding="utf-8"))
    return {**app, "dir": OUT_ROOT / app["out"], "data": data, "origin": data["origin"].rstrip("/"), "email": data["email"], "updated": data["updated"]}


def path(app, page, lang):
    return app["base"] + (page + "/" if page else "") + ("en/" if lang == "en" else "")


def asset(app, page, lang, name):
    depth = len(Path(path(app, page, lang).strip("/")).parts) - len(Path(app["base"].strip("/")).parts)
    return "../" * depth + "assets/" + name


def layout(app, page, lang, title, summary, body):
    w = app["words"][lang]
    other = "en" if lang == "zh" else "zh"
    data, origin, email = app["data"], app["origin"], app["email"]
    nav = [f'<a href="{path(app,"",lang)}#download">{"下载" if lang=="zh" else "Download"}</a>']
    for key in ("support", "privacy", "terms"):
        active = ' aria-current="page"' if key == page else ""
        nav.append(f'<a href="{path(app,key,lang)}"{active}>{escape(data["pages"][key][lang]["title"])}</a>')
    nav.append(f'<a class="language" href="{path(app,page,other)}" lang="{app["words"][other]["lang"]}" hreflang="{app["words"][other]["lang"]}">{w["other"]}</a>')
    icon = asset(app,page,lang,"app-icon.png")
    main_class = ' class="home"' if not page else ""
    extra = f'<link rel="stylesheet" href="{asset(app,page,lang,app["extra_css"])}">' if app.get("extra_css") else ""
    return f'''<!doctype html>
<html lang="{w['lang']}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="{escape(summary,quote=True)}"><meta name="theme-color" content="#faf7f0"><meta name="color-scheme" content="light"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'; form-action 'none'">
<title>{escape(title)} · {w['name']}</title>
<link rel="canonical" href="{origin}{path(app,page,lang)}"><link rel="alternate" hreflang="zh-Hans" href="{origin}{path(app,page,'zh')}"><link rel="alternate" hreflang="en" href="{origin}{path(app,page,'en')}">
<link rel="icon" type="image/png" href="{icon}"><link rel="stylesheet" href="{asset(app,page,lang,'site.css')}">{extra}
</head><body>
<a class="skip" href="#main">{w['skip']}</a>
<header class="site-header"><a class="brand" href="{path(app,'',lang)}"><img src="{icon}" width="44" height="44" alt=""><span>{w['name']}<small>{w['alt']}</small></span></a><nav class="site-nav" aria-label="{'页面导航' if lang=='zh' else 'Site navigation'}">{''.join(nav)}</nav></header>
<main id="main"{main_class}>{body}</main>
<footer class="site-footer"><p>© {date.fromisoformat(app['updated']).year} {escape(data['developer'])} · {w['footer']}</p><p><a href="mailto:{email}">{email}</a></p></footer>
</body></html>'''


def write(app, page, lang, html):
    target = app["dir"] / path(app,page,lang).strip("/") / "index.html"
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(html,encoding="utf-8")


def paras(p):
    """A section body is one paragraph (str) or several (list of str)."""
    return ''.join(f'<p>{x}</p>' for x in ([p] if isinstance(p, str) else p))


def strip_tags(text):
    return text.replace("<br>", " ")


def home_body(app, lang):
    """Product landing page: hero, features, screenshots, free vs Pro, platforms, help."""
    h, w, data, email = app["home"][lang], app["words"][lang], app["data"], app["email"]
    shot = lambda name: asset(app, "", lang, "shots/" + name)
    store = app["store"]
    store_btn = f'<a class="store-button" href="{store}" rel="noopener noreferrer"><span class="store-mark" aria-hidden="true"></span><span>{h["store"]}<small>{h["store_note"]}</small></span></a>'
    android_tag = f'<a class="soon-tag" href="#download"><span>{h["android"]}</span>{h["android_note"]}</a>'
    apk = app["apk"]
    apk_src = (ROOT / apk["src"]).resolve()
    apk_size = f' · {apk_src.stat().st_size / 1048576:.1f} MB' if apk_src.is_file() else ''
    apk_href = asset(app, "", lang, "../download/" + apk["file"]).replace("assets/../", "")
    apk_btn = f'<a class="store-button apk-button" href="{apk_href}" download><span class="store-mark" aria-hidden="true"></span><span>{h["apk_button"]}<small>{h["apk_note"]} · {apk["version"]}{apk_size}</small></span></a><p class="apk-help">{h["apk_help"]}</p>'
    facts = ''.join(f'<li>{f}</li>' for f in h["facts"])
    hero = f'''<section class="hero" aria-labelledby="hero-title"><div class="hero-copy"><img class="hero-icon" src="{asset(app,"",lang,"app-icon.png")}" width="80" height="80" alt=""><p class="eyebrow">{h["kicker"]}</p><h1 id="hero-title">{h["headline"]}</h1><p class="lead">{h["intro"]}</p><div class="cta">{store_btn}{android_tag}</div><ul class="home-facts">{facts}</ul></div><figure class="hero-shot"><div class="phone"><img src="{shot("phone-reader.jpg")}" width="720" height="1464" alt="{h["shot_alt"]}"></div></figure></section>'''
    features = ''.join(f'<li class="feature"><span class="feature-no" aria-hidden="true">{i:02}</span><h3>{t}</h3><p>{d}</p></li>' for i,(t,d) in enumerate(h["features"],1))
    features = f'<section class="block" aria-labelledby="features-title"><h2 class="block-title" id="features-title">{h["features_title"]}</h2><ul class="features">{features}</ul></section>'
    phones = ''.join(f'<figure class="shot"><div class="phone"><img src="{shot(n)}" width="720" height="1464" alt="{c}" loading="lazy"></div><figcaption>{c}</figcaption></figure>' for n,c in h["gallery"])
    ipad = f'<figure class="shot shot-wide"><div class="tablet"><img src="{shot(h["ipad"][0])}" width="1600" height="1159" alt="{h["ipad"][1]}" loading="lazy"></div><figcaption>{h["ipad"][1]}</figcaption></figure>'
    gallery = f'<section class="block" aria-labelledby="gallery-title"><h2 class="block-title" id="gallery-title">{h["gallery_title"]}</h2><div class="gallery">{phones}</div>{ipad}<p class="note">{h["sample_note"]}</p></section>'
    li = lambda items: ''.join(f'<li>{x}</li>' for x in items)
    plans = f'<section class="block" aria-labelledby="plans-title"><h2 class="block-title" id="plans-title">{h["plans_title"]}</h2><div class="plans"><div class="plan"><h3>{h["free_title"]}</h3><ul>{li(h["free"])}</ul></div><div class="plan plan-pro"><h3>{h["pro_title"]}</h3><ul>{li(h["pro"])}</ul></div></div><p class="note">{h["plans_note"]}</p></section>'
    platforms = f'''<section class="block" id="download" aria-labelledby="platforms-title"><h2 class="block-title" id="platforms-title">{h["platforms_title"]}</h2><div class="platforms"><div class="platform"><p class="status status-live">{h["ios_status"]}</p><h3>{h["ios_title"]}</h3><p>{h["ios_text"]}</p>{store_btn}</div><div class="platform"><p class="status">{h["android_status"]}</p><h3>{h["android_title"]}</h3><p>{h["android_text"]}</p>{apk_btn}</div></div></section>'''
    cards = []
    for page in ("support","privacy","terms"):
        e = data['pages'][page][lang]
        cards.append(f'<a class="card" href="{path(app,page,lang)}"><h3>{escape(e["title"])} →</h3><p>{escape(e["summary"])}</p></a>')
    help_ = f'<section class="block" aria-labelledby="help-title"><h2 class="block-title" id="help-title">{h["help_title"]}</h2><div class="cards">{"".join(cards)}</div><p class="home-contact">{w["contact"]} · <a href="mailto:{email}">{email}</a></p></section>'
    return hero + features + gallery + plans + platforms + help_


def build(app):
    data, email = app["data"], app["email"]
    assets = app["dir"] / app["base"].strip("/") / "assets"
    assets.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT / "site.css",assets / "site.css")
    shutil.copyfile(ROOT / app["icon"],assets / "app-icon.png")
    if app.get("extra_css"):
        shutil.copyfile(ROOT / app["extra_css"],assets / app["extra_css"])
    apk_src = (ROOT / app["apk"]["src"]).resolve()
    if apk_src.is_file():
        (app["dir"] / "download").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(apk_src, app["dir"] / "download" / app["apk"]["file"])
    else:
        print(f"warning: {apk_src} missing; Android download link will 404", file=sys.stderr)
    if (ROOT / "shots").is_dir():
        shutil.copytree(ROOT / "shots", assets / "shots", dirs_exist_ok=True)
    for lang in ("zh","en"):
        w = app["words"][lang]
        for page,translations in data["pages"].items():
            entry = translations[lang]
            page_updated = translations.get("updated", app["updated"])
            toc = ''.join(f'<li><a href="#section-{i}">{escape(h)}</a></li>' for i,(h,_) in enumerate(entry['sections'],1))
            sections = ''.join(f'<section id="section-{i}" aria-labelledby="heading-{i}"><h2 id="heading-{i}">{i}. {escape(h)}</h2>{paras(p)}</section>' for i,(h,p) in enumerate(entry['sections'],1))
            ending = '。' if lang=='zh' else '.'
            body = f'<div class="document-header"><p class="eyebrow">{app["eyebrow"]} / {w["home"]}</p><h1>{escape(entry["title"])}</h1><p class="lead">{escape(entry["summary"])}</p><p class="meta">{w["updated"]} · {page_updated} / iOS</p></div><nav class="contents" aria-label="{w["toc"]}"><p>{w["toc"]}</p><ol>{toc}</ol></nav><article>{sections}</article><p class="document-end">{w["end"]} <a href="mailto:{email}">{email}</a>{ending}</p>'
            write(app,page,lang,layout(app,page,lang,entry['title'],entry['summary'],body))
        write(app,'',lang,layout(app,'',lang,app["home"][lang]["title"],strip_tags(app["home"][lang]["intro"]),home_body(app,lang)))


apps = [load(app) for app in APPS]
for app in apps:
    build(app)

for out in dict.fromkeys(app["dir"] for app in apps):
    group = [app for app in apps if app["dir"] == out]
    (out/'_headers').write_text("""/*
  Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: public, max-age=300

/download/*
  Content-Type: application/vnd.android.package-archive
  Content-Disposition: attachment
""",encoding='utf-8')
    redirects = ''.join(app.get("redirects", "") for app in group)
    if redirects:
        (out/'_redirects').write_text(redirects,encoding='utf-8')
    sitemap = ET.Element('urlset',xmlns='http://www.sitemaps.org/schemas/sitemap/0.9')
    for app in group:
        for page in ('','privacy','terms','support'):
            for lang in ('zh','en'):
                item = ET.SubElement(sitemap,'url')
                ET.SubElement(item,'loc').text = app["origin"]+path(app,page,lang)
                ET.SubElement(item,'lastmod').text = app["data"]["pages"].get(page, {}).get("updated", app["updated"])
    (out/'sitemap.xml').write_bytes(ET.tostring(sitemap,encoding='utf-8',xml_declaration=True))
    (out/'robots.txt').write_text(f'User-agent: *\nAllow: /\nSitemap: {group[0]["origin"]}/sitemap.xml\n',encoding='utf-8')
print(json.dumps({'outputs':{str(app["dir"]):app["origin"] for app in apps},'htmlPages':8*len(apps),'apps':[a['slug'] for a in apps]},ensure_ascii=True))
