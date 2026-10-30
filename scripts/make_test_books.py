"""微光漫画测试素材生成（M0-03）。

全部页面由本脚本绘制（页码 + 分辨率），不含任何有版权的内容。
用法：python make_test_books.py [输出目录] [--big]
  默认生成小体积版本；--big 额外生成约 4 GB、2000 页的大压缩包（PRD 14.2 第 1 项）。
RAR 样本需要 WinRAR 的 rar 命令行；找不到时跳过并在清单里注明。
"""

import io
import json
import random
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(next((a for a in sys.argv[1:] if not a.startswith('--')), 'test-books'))
BIG = '--big' in sys.argv
manifest = []
CJK_FONTS = ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf', '/System/Library/Fonts/PingFang.ttc',
             '/System/Library/Fonts/Hiragino Sans GB.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc']
CJK_FONT = next((f for f in CJK_FONTS if Path(f).exists()), None)


def font(size):
    """有中日文字体就用，没有就退回 Pillow 自带字体（中日文会显示成方框，不影响测试）。"""
    return ImageFont.truetype(CJK_FONT, size) if CJK_FONT else ImageFont.load_default(size=size)


def page(label, w=800, h=1200, fmt='JPEG', quality=80, color=None):
    """一页图片：浅色底，居中写页码和尺寸，四边留一圈白边便于测试裁边。"""
    rnd = random.Random(label)
    bg = color or tuple(rnd.randint(150, 230) for _ in range(3))
    img = Image.new('RGB', (w, h), 'white')
    d = ImageDraw.Draw(img)
    m = max(8, min(w, h) // 20)
    d.rectangle([m, m, w - m, h - m], fill=bg)
    d.text((w / 2, h / 2), label, fill='black', font=font(max(16, min(w, h) // 10)), anchor='mm')
    d.text((w / 2, h / 2 + min(w, h) // 8), f'{w} x {h}', fill='black', font=font(max(12, min(w, h) // 30)), anchor='mm')
    buf = io.BytesIO()
    img.save(buf, fmt, **({'quality': quality} if fmt in ('JPEG', 'WEBP') else {}))
    return buf.getvalue()


class RawNameInfo(zipfile.ZipInfo):
    """按指定编码写入文件名且不设 UTF-8 标志，模拟 Windows 中文/日文系统打出的压缩包。"""

    def __init__(self, name, encoding):
        super().__init__(name)
        self._raw = name.encode(encoding)

    def _encodeFilenameFlags(self):
        return self._raw, self.flag_bits & ~0x800


def write_zip(path, entries, encoding=None, compress=zipfile.ZIP_STORED):
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, 'w', compress, allowZip64=True) as z:
        for name, data in entries:
            info = RawNameInfo(name, encoding) if encoding else zipfile.ZipInfo(name)
            info.compress_type = compress
            z.writestr(info, data)
    return path


def record(path, checks, expected=None):
    manifest.append({'file': str(path.relative_to(OUT)).replace('\\', '/'), 'size': path.stat().st_size if path.is_file() else None, 'checks': checks, 'expected_order': expected})


def big_zip():
    n = 2000 if BIG else 200
    w, h = (4000, 6000) if BIG else (1200, 1800)
    names = [f'{i:04d}.jpg' for i in range(1, n + 1)]
    p = OUT / ('big-4gb-2000p.zip' if BIG else 'large-200p.zip')
    if BIG:
        # 简单色块 JPEG 压缩后远小于原图，2000 张也未必有 4 GB。
        # 先流式写 4 GiB 的非图片填充，让所有图片的实际偏移都跨过 32 位边界。
        # 不把 4 GB 放进内存；填充条目不会进入漫画页列表。
        with zipfile.ZipFile(p, 'w', zipfile.ZIP_STORED, allowZip64=True) as z:
            chunk = bytes(1024 * 1024)
            with z.open('__performance__/zip64-padding.bin', 'w', force_zip64=True) as padding:
                for block in range(4096):
                    padding.write(chunk)
                    if (block + 1) % 512 == 0:
                        print(f'ZIP64 padding: {(block + 1) / 1024:g} GiB', flush=True)
            for i, name in enumerate(names, 1):
                z.writestr(name, page(f'{i}/{n}', w, h, quality=92))
                if i % 100 == 0:
                    print(f'ZIP64 pages: {i}/{n}', flush=True)
        with zipfile.ZipFile(p) as z:
            assert p.stat().st_size > 0xffffffff
            assert z.getinfo(names[-1]).header_offset > 0xffffffff
    else:
        write_zip(p, ((nm, page(f'{i}/{n}', w, h, quality=80)) for i, nm in enumerate(names, 1)))
    record(p, '打开 ≤ 1 秒、跳页、内存；--big 版约 4 GB（ZIP64）' if BIG else '大书的缩小版；正式验收用 --big', names)


def encoded_names():
    cases = {
        'gbk': ('gbk', '简体测试漫画', ['第1话/第01页.jpg', '第1话/第02页.jpg', '第2话/第01页.jpg', '番外/封面.jpg']),
        'big5': ('big5', '繁體測試', ['第1話/第01頁.jpg', '第1話/第02頁.jpg', '第2話/第01頁.jpg', '番外/封面.jpg']),
        'shift_jis': ('shift_jis', 'テスト漫画', ['第1話/01ページ.jpg', '第1話/02ページ.jpg', '第2話/01ページ.jpg', '番外編/表紙.jpg']),
    }
    for key, (enc, title, files) in cases.items():
        names = [f'{title}/{f}' for f in files]
        p = write_zip(OUT / f'names-{key}.zip', ((n, page(n.split('/', 1)[1])) for n in names), encoding=enc)
        record(p, f'文件名按 {enc} 编码且无 UTF-8 标志：不乱码，番外排最后', names)


def chinese_numbers():
    cn = '一二三四五六七八九十'
    def zh(n):
        return cn[n - 1] if n <= 10 else '二十' if n == 20 else '十' + cn[n - 11]
    root = OUT / 'series-zh-numbers'
    shutil.rmtree(root, ignore_errors=True)
    chapters = [f'第{zh(i)}话' if i % 2 else f'第{i}话' for i in range(1, 21)] + ['番外']
    for ch in chapters:
        for j in (1, 2):
            f = root / ch / f'{j:02d}.jpg'
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(page(f'{ch} {j}'))
    record(root, '中文数字与阿拉伯数字混排的话数文件夹：第二话在第十二话前，番外最后；整个文件夹导入归为一个系列', chapters)


def long_strips():
    names = [f'{i:02d}.jpg' for i in range(1, 31)]
    p = write_zip(OUT / 'webtoon-30x800x20000.zip', ((n, page(f'条漫 {i}', 800, 20000, quality=70)) for i, n in enumerate(names, 1)))
    record(p, '条漫：帧率、不闪退、进度还原；高宽比 25 应提示切到竖向滚动', names)


def manga_volume():
    """日漫单卷：缺封面、含跨页图，ComicInfo 标为从右往左。"""
    entries, names = [], []
    for i in range(2, 41):
        if i in (11, 25):
            n = f'{i:03d}-{i + 1:03d}.jpg'
            entries.append((n, page(f'跨页 {i}-{i + 1}', 1600, 1200)))
        elif i - 1 in (11, 25):
            continue
        else:
            n = f'{i:03d}.jpg'
            entries.append((n, page(f'P{i}')))
        names.append(n)
    comicinfo = '<?xml version="1.0"?>\n<ComicInfo><Series>测试日漫</Series><Volume>3</Volume><Number>3</Number><Title>第三卷</Title><Manga>YesAndRightToLeft</Manga></ComicInfo>'
    p = write_zip(OUT / 'manga-vol3-rtl-spreads.cbz', entries + [('ComicInfo.xml', comicinfo.encode())])
    record(p, '从右往左（读 ComicInfo）；缺封面导致双页错位，可「错开一页」；跨页独占一屏', names)


def spread_sorting():
    names = [f'p{i}.jpg' for i in range(1, 25) if i not in (12, 13)] + ['p12-13.jpg']
    expected = [f'p{i}.jpg' for i in range(1, 12)] + ['p12-13.jpg'] + [f'p{i}.jpg' for i in range(14, 25)]
    p = write_zip(OUT / 'spread-name-sorting.zip', ((n, page(n[:-4], *((1600, 1200) if '-' in n else (800, 1200)))) for n in names))
    record(p, '不补零的页码加跨页文件名：跨页留在第 11 页之后，不被排到书末', expected)


def corrupt_page():
    names = [f'{i:02d}.jpg' for i in range(1, 11)]
    entries = [(n, page(n) if n != '05.jpg' else page(n)[:2000]) for n in names]
    p = write_zip(OUT / 'corrupt-page-05.zip', entries)
    record(p, '第 5 页被截断：该页显示「此页无法显示」，其余照常翻页', names)


def junk_and_webp():
    names = [f'{i:02d}.webp' for i in range(1, 9)]
    entries = [(n, page(n, fmt='WEBP')) for n in names]
    entries += [('__MACOSX/._01.webp', b'\0' * 64), ('.DS_Store', b'\0' * 64), ('Thumbs.db', b'\0' * 64), ('readme.txt', b'not a page')]
    p = write_zip(OUT / 'webp-with-junk.zip', entries)
    record(p, 'WebP 页面；忽略 __MACOSX、.DS_Store、Thumbs.db、非图片文件，只剩 8 页', names)


def nested():
    inner = []
    for v in (1, 2, 3):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w') as z:
            for i in range(1, 6):
                z.writestr(f'{i:02d}.jpg', page(f'卷{v} P{i}'))
        inner.append((f'测试合集/第{v}卷.zip', buf.getvalue()))
    p = write_zip(OUT / 'nested-collection.zip', inner)
    record(p, '合集里再包各卷压缩包（P1）：作为一个系列导入，3 卷', [n for n, _ in inner])


def fixed_layout_epub():
    pages = [f'p{i:02d}' for i in range(1, 13)]
    opf_items = '\n'.join(f'<item id="{p}" href="{p}.xhtml" media-type="application/xhtml+xml" properties="rendition:page-spread-center"/><item id="img-{p}" href="img/{p}.jpg" media-type="image/jpeg"/>' for p in pages)
    spine = '\n'.join(f'<itemref idref="{p}"/>' for p in pages)
    opf = f'''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">test-fixed-layout</dc:identifier><dc:title>测试漫画 EPUB</dc:title><dc:language>zh</dc:language><meta property="rendition:layout">pre-paginated</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{opf_items}</manifest><spine page-progression-direction="rtl">{spine}</spine></package>'''
    xhtml = '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><meta name="viewport" content="width=800,height=1200"/></head><body><img src="img/{p}.jpg" alt=""/></body></html>'
    nav = '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="p01.xhtml">开始</a></li></ol></nav></body></html>'
    path = OUT / 'fixed-layout-12p.epub'
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr(zipfile.ZipInfo('mimetype'), 'application/epub+zip')
        z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        z.writestr('OEBPS/content.opf', opf)
        z.writestr('OEBPS/nav.xhtml', nav)
        for p in pages:
            z.writestr(f'OEBPS/{p}.xhtml', xhtml.format(p=p))
            z.writestr(f'OEBPS/img/{p}.jpg', page(p))
    record(path, '一页一图的固定版式 EPUB：按 spine 顺序 12 页，从右往左', pages)


def rar_samples():
    rar = shutil.which('rar') or next((str(p) for p in (Path('C:/Program Files/WinRAR/Rar.exe'), Path('C:/Program Files (x86)/WinRAR/Rar.exe')) if p.exists()), None)
    src = OUT / '_rar-src'
    shutil.rmtree(src, ignore_errors=True)
    names = [f'{i:02d}.jpg' for i in range(1, 11)]
    for n in names:
        (src / n).parent.mkdir(parents=True, exist_ok=True)
        (src / n).write_bytes(page(f'RAR {n}'))
    if not rar:
        manifest.append({'file': 'rar4.cbr / rar5.cbr / rar5-encrypted.cbr', 'size': None, 'checks': '已跳过：本机没有 WinRAR 的 rar 命令行。装好后重跑本脚本即可生成', 'expected_order': names})
        shutil.rmtree(src, ignore_errors=True)
        return
    for out, extra in (('rar4.cbr', ['-ma4']), ('rar5.cbr', ['-ma5']), ('rar5-encrypted.cbr', ['-ma5', '-hptest'])):
        target = (OUT / out).resolve()
        target.unlink(missing_ok=True)
        subprocess.run([rar, 'a', '-ep1', '-idq', *extra, str(target), *[str((src / n).resolve()) for n in names]], check=True)
        record(OUT / out, '加密包应给出明确提示' if 'encrypted' in out else f'{out[:4].upper()} 正常打开', names)
    shutil.rmtree(src, ignore_errors=True)


def mock_shelf():
    rnd = random.Random(5000)
    books = [{'title': f'测试系列 {s:03d} 第{v}卷', 'series': f'测试系列 {s:03d}', 'volume': v, 'pageCount': rnd.randint(150, 260), 'sizeBytes': rnd.randint(30, 400) * 1024 * 1024} for s in range(1, 501) for v in range(1, 11)]
    path = OUT / 'mock-shelf-5000.json'
    path.write_text(json.dumps(books, ensure_ascii=False), encoding='utf-8')
    record(path, '5000 本书的书架记录（没有文件）：书架滚动流畅', None)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for step in (big_zip, encoded_names, chinese_numbers, long_strips, manga_volume, spread_sorting, corrupt_page, junk_and_webp, nested, fixed_layout_epub, rar_samples, mock_shelf):
        step()
        print('done', step.__name__, flush=True)
    (OUT / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'{len(manifest)} items -> {OUT.resolve()}')
