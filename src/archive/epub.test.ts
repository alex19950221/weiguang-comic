import { describe, expect, it } from 'vitest';
import { epubBook, resolveHref, xmlTags } from './epub';
import type { Inspection } from '@/native/comicArchive';

const container = `<?xml version="1.0"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

function book(
  files: Record<string, string | null>,
): Pick<Inspection, 'entries' | 'texts'> {
  const names = Object.keys(files);
  return {
    entries: names.map((name, index) => ({ index, name, size: 10 })),
    texts: names.flatMap((name, index) => {
      const text = files[name];
      return text === null || text === undefined ? [] : [{ index, text }];
    }),
  };
}

const page = (src: string) =>
  `<html xmlns="http://www.w3.org/1999/xhtml"><body><img src="${src}" alt=""/></body></html>`;

describe('EPUB 阅读顺序', () => {
  it('按 spine 与页面文档中的图片顺序，不按文件名排序，并识别右翻', () => {
    const opf = `<package xmlns="http://www.idpf.org/2007/opf">
      <manifest>
        <item id="p1" href="Text/p1.xhtml" media-type="application/xhtml+xml"/>
        <item id="p2" href="Text/p2.xhtml" media-type="application/xhtml+xml"/>
        <item id="svg" href="Text/p3.xhtml" media-type="application/xhtml+xml"/>
        <item id="raw" href="Images/%E5%B0%81%E5%BA%95.png" media-type="image/png"/>
        <item id="cover" href="Images/b.jpg" media-type="image/jpeg"/>
      </manifest>
      <spine page-progression-direction="rtl" toc="ncx">
        <itemref idref="p2"/><itemref idref="p1"/><itemref idref="svg"/><itemref idref="raw"/>
      </spine></package>`;
    const result = epubBook(
      book({
        mimetype: null,
        'META-INF/container.xml': container,
        'OEBPS/content.opf': opf,
        'OEBPS/Text/p1.xhtml': page('../Images/a.jpg'),
        'OEBPS/Text/p2.xhtml': page('../Images/b.jpg#frag'),
        'OEBPS/Text/p3.xhtml': `<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image width="1" xlink:href="../Images/c.jpg"/></svg>`,
        'OEBPS/Images/a.jpg': null,
        'OEBPS/Images/b.jpg': null,
        'OEBPS/Images/c.jpg': null,
        'OEBPS/Images/封底.png': null,
        'OEBPS/Images/unused.jpg': null,
      }),
    );
    expect(result.pages.map((p) => p.name)).toEqual([
      'OEBPS/Images/b.jpg',
      'OEBPS/Images/a.jpg',
      'OEBPS/Images/c.jpg',
      'OEBPS/Images/封底.png',
    ]);
    expect(result).toMatchObject({
      rtl: true,
      protectedContent: false,
      textHeavy: false,
    });
  });

  it('缺少容器或 OPF 时退回自然排序的全部图片', () => {
    const result = epubBook(
      book({ 'img/10.jpg': null, 'img/2.jpg': null, 'x.css': null }),
    );
    expect(result.pages.map((p) => p.name)).toEqual([
      'img/2.jpg',
      'img/10.jpg',
    ]);
    expect(result.rtl).toBe(false);
  });

  it('资源加密或带 FairPlay 文件视为受保护；仅字体混淆不算', () => {
    const encryption = (uri: string) =>
      `<encryption><EncryptedData><CipherData><CipherReference URI="${uri}"/></CipherData></EncryptedData></encryption>`;
    expect(
      epubBook(
        book({
          'META-INF/encryption.xml': encryption('OEBPS/Fonts/a.otf'),
          'a.jpg': null,
        }),
      ).protectedContent,
    ).toBe(false);
    expect(
      epubBook(
        book({
          'META-INF/encryption.xml': encryption('OEBPS/Images/a.jpg'),
          'a.jpg': null,
        }),
      ).protectedContent,
    ).toBe(true);
    expect(
      epubBook(book({ 'META-INF/sinf.xml': '<x/>', 'a.jpg': null }))
        .protectedContent,
    ).toBe(true);
  });

  it('文字为主的 EPUB 标记为文字书，不把插图当作漫画', () => {
    const prose = `<html><body><p>${'很长的正文。'.repeat(60)}</p></body></html>`;
    const opf = `<package><manifest>
      <item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/>
      <item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/>
      <item id="c3" href="c3.xhtml" media-type="application/xhtml+xml"/>
    </manifest><spine><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3"/></spine></package>`;
    const result = epubBook(
      book({
        'META-INF/container.xml': container,
        'OEBPS/content.opf': opf,
        'OEBPS/c1.xhtml': prose,
        'OEBPS/c2.xhtml': prose,
        'OEBPS/c3.xhtml': prose,
        'OEBPS/cover.jpg': null,
      }),
    );
    expect(result).toMatchObject({ textHeavy: true, pages: [] });
  });
});

describe('EPUB 路径与标签', () => {
  it('解析相对、绝对与百分号编码路径，拒绝外链与越界', () => {
    expect(resolveHref('OEBPS/Text/p.xhtml', '../Images/a%20b.jpg')).toBe(
      'OEBPS/Images/a b.jpg',
    );
    expect(resolveHref('OEBPS/content.opf', './p.xhtml?x=1')).toBe(
      'OEBPS/p.xhtml',
    );
    expect(resolveHref('OEBPS/p.xhtml', '/root.jpg')).toBe('root.jpg');
    expect(resolveHref('p.xhtml', '../../etc/passwd')).toBeNull();
    expect(resolveHref('p.xhtml', 'https://example.com/a.jpg')).toBeNull();
    expect(resolveHref('p.xhtml', 'data:image/png;base64,AAAA')).toBeNull();
    expect(resolveHref('p.xhtml', '%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('忽略注释，解码实体，属性名去掉命名空间前缀', () => {
    const tags = xmlTags(
      `<!-- <img src="no.jpg"/> --><opf:item id='a' href="x&amp;y.jpg"/><svg:image xlink:href="z.png"/>`,
    );
    expect(tags.map((tag) => tag.name)).toEqual(['item', 'image']);
    expect(tags[0]!.attributes.get('href')).toBe('x&y.jpg');
    expect(tags[1]!.attributes.get('href')).toBe('z.png');
  });
});
