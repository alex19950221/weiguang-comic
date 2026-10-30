export type VolumeUnit = '卷' | '话';
export interface ParsedComicName {
  /** 去掉扩展名、括号标注和卷号后的系列名。 */
  title: string;
  volume: number | null;
  unit: VolumeUnit;
}
export type ReadingState = 'unread' | 'reading' | 'finished';

const extension = /\.(cbz|cbr|cb7|zip|rar|7z)$/i;
// 方括号、圆括号、书名号标注通常是作者、年份、扫图组，不属于书名。
const annotations = /[[【(（][^\]】)）]*[\]】)）]/g;
const volumePatterns: readonly [RegExp, VolumeUnit][] = [
  [/第\s*(\d+)\s*[卷册冊集]/, '卷'],
  [/第\s*(\d+)\s*[话話回]/, '话'],
  [/\b(?:vol(?:ume)?|v)\.?\s*(\d+)\b/i, '卷'],
  [/\b(?:ch(?:apter)?|ep)\.?\s*(\d+)\b/i, '话'],
  [/(?:^|\s)#(\d+)\b/, '卷'],
  [/[\s\-–—]+(\d{1,3})\s*$/, '卷'],
];

/** 从文件名或文件夹名识别系列名与卷号；识别不到卷号时整体当作单本。 */
export function parseComicName(fileName: string): ParsedComicName {
  let name = fileName
    .normalize('NFKC')
    .replace(extension, '')
    .replace(annotations, ' ')
    .replace(/_+/g, ' ');
  let volume: number | null = null;
  let unit: VolumeUnit = '卷';
  for (const [pattern, patternUnit] of volumePatterns) {
    const match = pattern.exec(name);
    if (!match) continue;
    volume = Number(match[1]);
    unit = patternUnit;
    name = `${name.slice(0, match.index)} ${name.slice(match.index + match[0].length)}`;
    break;
  }
  const title = name
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—·.:：]+|[\s\-–—·.:：]+$/g, '')
    .trim();
  return {
    title: title || fileName.replace(extension, '').trim() || fileName,
    volume,
    unit,
  };
}

/** 同一系列的比较键：忽略大小写、全半角、空格和常见分隔符。 */
export function seriesKey(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\-_·:：.,，、!！?？'"“”‘’]/g, '');
}

export function readingState(
  page: number | undefined,
  pages: number,
): ReadingState {
  if (page === undefined) return 'unread';
  return page >= pages - 1 ? 'finished' : 'reading';
}

/** 系列整体状态：全部读完才算读完，全部未读才算未读。 */
export function seriesReadingState(
  states: readonly ReadingState[],
): ReadingState {
  if (states.length && states.every((state) => state === 'finished'))
    return 'finished';
  if (states.every((state) => state === 'unread')) return 'unread';
  return 'reading';
}

const collator = new Intl.Collator('zh-CN', { numeric: true });

/** 按系列归组；卷内按卷号升序，无卷号的排在后面并按文件名自然排序。 */
export function groupBySeries<T>(
  items: readonly T[],
  describe: (item: T) => { key: string; volume: number | null; name: string },
): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const { key } = describe(item);
    const list = groups.get(key);
    if (list) list.push(item);
    else groups.set(key, [item]);
  }
  return [...groups].map(([key, list]) => ({
    key,
    items: list.sort((a, b) => {
      const left = describe(a);
      const right = describe(b);
      if (left.volume !== null && right.volume !== null)
        return (
          left.volume - right.volume || collator.compare(left.name, right.name)
        );
      if (left.volume !== null) return -1;
      if (right.volume !== null) return 1;
      return collator.compare(left.name, right.name);
    }),
  }));
}

export function compareTitles(a: string, b: string): number {
  return collator.compare(a, b);
}
