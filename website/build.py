"""Generate the LumiComic support and legal site; Python standard library only.

Home, support, privacy and terms in Chinese and English, deployed to Cloudflare Pages
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
        "home": {
            "zh": {"headline":"安静地，看完一整卷。", "intro":"微光漫卷是一款本地漫画阅读器：导入你自己的 ZIP、CBZ、PDF 或图片漫画 EPUB，系列会自动按卷、话排好。漫画留在本机，无需账户、没有广告、不收集数据，即将在 App Store 推出。在这里查看技术支持、隐私政策与用户协议。", "facts":["无需注册","不收集数据","一次买断"]},
            "en": {"headline":"Quiet pages.<br>Whole volumes.", "intro":"LumiComic is a local comic reader. Import your own ZIP, CBZ, PDF or image-based EPUB comics, and series are sorted by volume and chapter for you. Your comics stay on your device: no account, no ads, no data collected. Coming soon to the App Store. Find support, privacy information and terms here.", "facts":["No account","No data collected","One-time purchase"]},
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
    nav = []
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


def build(app):
    data, email = app["data"], app["email"]
    assets = app["dir"] / app["base"].strip("/") / "assets"
    assets.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(ROOT / "site.css",assets / "site.css")
    shutil.copyfile(ROOT / app["icon"],assets / "app-icon.png")
    if app.get("extra_css"):
        shutil.copyfile(ROOT / app["extra_css"],assets / app["extra_css"])
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
        cards = []
        for page,num in (("support","01"),("privacy","02"),("terms","03")):
            e = data['pages'][page][lang]
            cards.append(f'<a class="card" href="{path(app,page,lang)}"><span>{num}</span><h2>{escape(e["title"])} →</h2><p>{escape(e["summary"])}</p></a>')
        home = app["home"][lang]
        fact_items = ''.join(f'<li>{f}</li>' for f in home["facts"])
        body = f'<section class="home-hero"><img src="{asset(app,"",lang,"app-icon.png")}" width="88" height="88" alt=""><p class="eyebrow">{app["eyebrow"]} / {w["home"]}</p><h1>{home["headline"]}</h1><p class="lead">{home["intro"]}</p><ul class="home-facts">{fact_items}</ul></section><div class="cards">{"".join(cards)}</div><p class="home-contact">{w["contact"]} · <a href="mailto:{email}">{email}</a></p>'
        write(app,'',lang,layout(app,'',lang,w['home'],home["intro"],body))


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
