import type { ArchiveEntry } from '@/native/comicArchive';

export interface ComicPage {
  entry: number;
  name: string;
}

export type LegacyEncoding = 'gb18030' | 'big5' | 'shift_jis';

export function decodedName(
  entry: ArchiveEntry,
  encoding: LegacyEncoding = 'gb18030',
): string {
  if (entry.name !== undefined) return entry.name;
  if (!entry.rawName) return '';
  const bytes = Uint8Array.from(atob(entry.rawName), (value) =>
    value.charCodeAt(0),
  );
  // M0 先允许手动选择编码；自动识别在 IM-05 完成。
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder(encoding).decode(bytes);
  }
}

/** 不把超长数字转成 Number，避免页码丢精度；同名条目保留原包顺序。 */
export function naturalCompare(left: string, right: string): number {
  const a =
    left
      .normalize('NFC')
      .toLowerCase()
      .match(/\d+|\D+/g) ?? [];
  const b =
    right
      .normalize('NFC')
      .toLowerCase()
      .match(/\d+|\D+/g) ?? [];
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const x = a[index]!;
    const y = b[index]!;
    if (x === y) continue;
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const nx = x.replace(/^0+(?=\d)/, '');
      const ny = y.replace(/^0+(?=\d)/, '');
      if (nx.length !== ny.length) return nx.length - ny.length;
      if (nx !== ny) return nx < ny ? -1 : 1;
      continue;
    }
    return x < y ? -1 : 1;
  }
  return a.length - b.length;
}

export function pageList(
  entries: readonly ArchiveEntry[],
  encoding: LegacyEncoding = 'gb18030',
): ComicPage[] {
  return entries
    .flatMap((entry): ComicPage[] => {
      if (entry.isDirectory || entry.isSymlink || entry.size <= 0) return [];
      const name = decodedName(entry, encoding).replaceAll('\\', '/');
      const parts = name.split('/');
      if (
        /^(?:\/|[a-z]:)/i.test(name) ||
        parts.some((part) => !part || part === '..' || part.startsWith('.')) ||
        parts.includes('__MACOSX') ||
        !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name)
      )
        return [];
      return [{ entry: entry.index, name }];
    })
    .sort((a, b) => naturalCompare(a.name, b.name) || a.entry - b.entry);
}

/** PDF 页按原生给出的页序阅读，不按名称重排；跳过重复或无效的序号。 */
export function pdfPageList(entries: readonly ArchiveEntry[]): ComicPage[] {
  const seen = new Set<number>();
  return entries
    .filter(
      (entry) =>
        Number.isSafeInteger(entry.index) &&
        entry.index >= 0 &&
        !entry.isDirectory &&
        !entry.isSymlink &&
        !seen.has(entry.index) &&
        seen.add(entry.index),
    )
    .sort((a, b) => a.index - b.index)
    .map((entry) => ({
      entry: entry.index,
      name: entry.name ?? String(entry.index + 1).padStart(4, '0'),
    }));
}
