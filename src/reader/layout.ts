import type { Book, ReadingMode } from '@/db/models';
import { compareTitles } from '@/library/series';
import {
  buildSpreads,
  spreadAnchor,
  spreadIndexOf,
  type SpreadCover,
} from './spread';
import { clampPage, clampOffset, progressAnchor } from './progress';

export interface ReadingPosition {
  page: number;
  offset: number;
}
/** 倒数第二页落在双页第二侧时也遵守末两页完成规则。 */
export function visibleAnchor(pages: readonly number[], count: number): number {
  return pages.some((page) => progressAnchor(page, count) === count - 1)
    ? Math.max(0, count - 1)
    : spreadAnchor(pages, count);
}
export function visiblePages(
  page: number,
  count: number,
  mode: ReadingMode,
  cover: SpreadCover,
): number[] {
  const current = clampPage(page, count);
  const spreads = buildSpreads(count, cover);
  return mode === 'spread'
    ? (spreads[spreadIndexOf(spreads, current)] ?? [])
    : count > 0
      ? [current]
      : [];
}
export function pageWindow(
  visible: readonly number[],
  count: number,
): number[] {
  if (!visible.length) return [];
  return [
    ...new Set([
      ...visible,
      Math.max(...visible) + 1,
      Math.min(...visible) - 1,
    ]),
  ]
    .filter((index) => index >= 0 && index < count)
    .slice(0, 3);
}
export function nextVolume(
  current: Book,
  books: readonly Book[],
): Book | undefined {
  const number = (book: Book) =>
    book.unit === '话' ? book.chapter : book.volume;
  const currentNumber = number(current);
  if (!current.seriesId || currentNumber === null) return;
  return books
    .filter(
      (book) =>
        book.id !== current.id &&
        book.seriesId === current.seriesId &&
        book.unit === current.unit &&
        book.status === 'ready' &&
        book.pageCount > 0 &&
        number(book) !== null &&
        number(book)! > currentNumber,
    )
    .sort(
      (a, b) =>
        number(a)! - number(b)! ||
        compareTitles(a.fileName ?? a.title, b.fileName ?? b.title) ||
        a.id.localeCompare(b.id),
    )[0];
}
/** 未加载的页面仅占位；真实比例来自原生降采样结果，不读取原图。 */
export function scrollLayout(
  count: number,
  width: number,
  ratios: ReadonlyMap<number, number>,
): number[] {
  const positions = [0];
  for (let page = 0; page < count; page++) {
    const ratio = ratios.get(page) ?? 1.5;
    positions.push(
      positions[page]! +
        Math.max(1, width) *
          (Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5),
    );
  }
  return positions;
}
export function positionAt(
  positions: readonly number[],
  top: number,
): ReadingPosition {
  const count = positions.length - 1;
  if (count <= 0) return { page: 0, offset: 0 };
  let lo = 0,
    hi = count - 1;
  const y = Number.isFinite(top) ? Math.max(0, top) : 0;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (positions[mid]! <= y) lo = mid;
    else hi = mid - 1;
  }
  return {
    page: lo,
    offset: clampOffset(
      (y - positions[lo]!) / Math.max(1, positions[lo + 1]! - positions[lo]!),
    ),
  };
}
export function topAt(
  positions: readonly number[],
  position: ReadingPosition,
): number {
  const page = clampPage(position.page, positions.length - 1);
  return (
    (positions[page] ?? 0) +
    ((positions[page + 1] ?? 0) - (positions[page] ?? 0)) *
      clampOffset(position.offset)
  );
}
