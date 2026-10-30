import type { ComicPage } from '@/archive/pageList';

export interface ContentsSection {
  path: string;
  start: number;
  end: number;
}
/** 去掉所有页面共有的目录前缀，不凭空生成章节，也不改变包内阅读顺序。 */
export function contentsSections(
  pages: readonly ComicPage[],
): ContentsSection[] {
  const folders = pages.map((page) =>
    page.name.replaceAll('\\', '/').split('/').slice(0, -1),
  );
  if (!folders.length) return [];
  let shared = 0;
  while (
    folders[0]?.[shared] !== undefined &&
    folders.every((parts) => parts[shared] === folders[0]![shared])
  )
    shared++;
  const sections: ContentsSection[] = [];
  folders.forEach((parts, index) => {
    const path = parts.slice(shared).join('/');
    const previous = sections.at(-1);
    if (previous?.path === path) previous.end = index;
    else sections.push({ path, start: index, end: index });
  });
  return sections.length > 1 && sections.some((section) => section.path)
    ? sections
    : [];
}
export const CONTENTS_PAGE_SIZE = 48;
export function contentsRange(page: number, count: number) {
  const total = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);
  const current = Number.isFinite(page)
    ? Math.max(0, Math.min(total - 1, Math.floor(page)))
    : 0;
  const start = Math.floor(current / CONTENTS_PAGE_SIZE) * CONTENTS_PAGE_SIZE;
  return { start, end: Math.min(total, start + CONTENTS_PAGE_SIZE) };
}
