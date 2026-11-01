import type { ArchiveEntry, Inspection } from '@/native/comicArchive';
import { decodedName, pageList, type ComicPage } from './pageList';

export interface EpubBook {
  pages: ComicPage[];
  /** OPF spine 声明 page-progression-direction="rtl"。 */
  rtl: boolean;
  /** 资源加密或带 Apple/Adobe 版权保护文件；不尝试解密。 */
  protectedContent: boolean;
  /** 过半 spine 文档只有文字没有图片：属于文字书，漫画阅读器不支持。 */
  textHeavy: boolean;
}

interface Tag {
  name: string;
  attributes: Map<string, string>;
}

const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, code: string) => {
      if (code[0] !== '#') return entities[code.toLowerCase()] ?? match;
      const point = Number.parseInt(
        code[1]?.toLowerCase() === 'x' ? code.slice(2) : code.slice(1),
        code[1]?.toLowerCase() === 'x' ? 16 : 10,
      );
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    },
  );
}

/** 按文档顺序列出开始标签；去掉注释与 CDATA，名称与属性名忽略命名空间前缀和大小写。 */
export function xmlTags(text: string): Tag[] {
  const source = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  const tags: Tag[] = [];
  for (const match of source.matchAll(
    /<([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
  )) {
    const attributes = new Map<string, string>();
    for (const attribute of match[2]!.matchAll(
      /([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    )) {
      const key = attribute[1]!.toLowerCase();
      const local = key.slice(key.lastIndexOf(':') + 1);
      const value = decodeEntities(attribute[2] ?? attribute[3] ?? '');
      // 带前缀的 xlink:href 与普通 href 都归到本地名；先出现的不被覆盖。
      if (!attributes.has(local)) attributes.set(local, value);
      attributes.set(key, value);
    }
    const name = match[1]!.toLowerCase();
    tags.push({ name: name.slice(name.lastIndexOf(':') + 1), attributes });
  }
  return tags;
}

/** 把相对引用解析为包内路径；外部链接、data: 与越出根目录的路径返回 null。 */
export function resolveHref(base: string, href: string): string | null {
  const raw = href.trim().replace(/[#?].*$/, '');
  if (!raw || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//'))
    return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  const directory = base.includes('/')
    ? base.slice(0, base.lastIndexOf('/') + 1)
    : '';
  const joined = decoded.startsWith('/')
    ? decoded.slice(1)
    : directory + decoded;
  const parts: string[] = [];
  for (const part of joined.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!parts.length) return null;
      parts.pop();
    } else parts.push(part);
  }
  return parts.length ? parts.join('/') : null;
}

function visibleText(document: string): string {
  const body = /<body[\s>][\s\S]*$/i.exec(document)?.[0] ?? document;
  return body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '');
}

const fontFile = /\.(ttf|otf|woff2?)$/i;
const documentType = /(x?html|xml|svg)/i;

/** 按 OPF spine 与页面文档中的图片引用生成漫画页序；解析不到时退回按文件名自然排序。 */
export function epubBook(
  inspection: Pick<Inspection, 'entries' | 'texts'>,
): EpubBook {
  const images = pageList(inspection.entries);
  const byName = new Map(images.map((page) => [page.name, page]));
  const byLowerName = new Map(
    images.map((page) => [page.name.toLowerCase(), page]),
  );
  const names = new Map<number, string>(
    inspection.entries.map((entry: ArchiveEntry) => [
      entry.index,
      decodedName(entry).replaceAll('\\', '/'),
    ]),
  );
  const texts = new Map<string, string>();
  for (const { index, text } of inspection.texts ?? []) {
    const name = names.get(index);
    if (name !== undefined) texts.set(name.toLowerCase(), text);
  }
  const text = (name: string) => texts.get(name.toLowerCase());

  const allNames = [...names.values()].map((name) => name.toLowerCase());
  let protectedContent = allNames.some(
    (name) => name === 'meta-inf/rights.xml' || name === 'meta-inf/sinf.xml',
  );
  const encryption = text('META-INF/encryption.xml');
  if (encryption)
    protectedContent ||= xmlTags(encryption).some((tag) => {
      if (tag.name !== 'cipherreference') return false;
      const target = resolveHref('', tag.attributes.get('uri') ?? '');
      // 字体混淆是 EPUB 标准做法，不影响图片；其他资源加密即视为受保护。
      return !target || !fontFile.test(target);
    });

  const container = text('META-INF/container.xml');
  const rootPath = container
    ? xmlTags(container)
        .filter((tag) => tag.name === 'rootfile')
        .map((tag) => resolveHref('', tag.attributes.get('full-path') ?? ''))
        .find((path): path is string => !!path && !!text(path))
    : undefined;
  const opf = rootPath ? text(rootPath) : undefined;
  if (!rootPath || !opf)
    return { pages: images, rtl: false, protectedContent, textHeavy: false };

  const opfTags = xmlTags(opf);
  const manifest = new Map<string, { path: string; type: string }>();
  let rtl = false;
  const spine: string[] = [];
  for (const tag of opfTags) {
    if (tag.name === 'item') {
      const id = tag.attributes.get('id');
      const path = resolveHref(rootPath, tag.attributes.get('href') ?? '');
      if (id && path)
        manifest.set(id, {
          path,
          type: tag.attributes.get('media-type') ?? '',
        });
    } else if (tag.name === 'spine') {
      rtl = tag.attributes.get('page-progression-direction') === 'rtl';
    } else if (tag.name === 'itemref') {
      const id = tag.attributes.get('idref');
      if (id) spine.push(id);
    }
  }

  const pages: ComicPage[] = [];
  const seen = new Set<number>();
  const add = (path: string | null) => {
    if (!path) return;
    const page = byName.get(path) ?? byLowerName.get(path.toLowerCase());
    if (!page || seen.has(page.entry)) return;
    seen.add(page.entry);
    pages.push(page);
  };
  let documents = 0;
  let textDocuments = 0;
  for (const id of spine) {
    const item = manifest.get(id);
    if (!item) continue;
    if (item.type.startsWith('image/')) {
      add(item.path);
      continue;
    }
    const document = documentType.test(item.type) ? text(item.path) : undefined;
    if (!document) continue;
    documents++;
    const tags = xmlTags(document);
    if (
      !tags.some((tag) => tag.name === 'img' || tag.name === 'image') &&
      visibleText(document).length >= 200
    )
      textDocuments++;
    for (const tag of tags) {
      if (tag.name === 'img')
        add(resolveHref(item.path, tag.attributes.get('src') ?? ''));
      else if (tag.name === 'image')
        add(resolveHref(item.path, tag.attributes.get('href') ?? ''));
    }
  }
  const textHeavy = documents > 0 && textDocuments * 2 > documents;
  return {
    pages: pages.length ? pages : textHeavy ? [] : images,
    rtl,
    protectedContent,
    textHeavy,
  };
}
