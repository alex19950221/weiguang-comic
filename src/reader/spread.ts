export type SpreadCover = 'alone' | 'paired';
export type ReadingDirection = 'ltr' | 'rtl';

/** 双页配对：封面可单独占一屏，其余两页一组，末尾不足两页时单独显示。 */
export function buildSpreads(
  pageCount: number,
  cover: SpreadCover,
): number[][] {
  const count = Number.isFinite(pageCount)
    ? Math.max(0, Math.floor(pageCount))
    : 0;
  const spreads: number[][] = [];
  let start = 0;
  if (cover === 'alone' && count > 0) {
    spreads.push([0]);
    start = 1;
  }
  for (let page = start; page < count; page += 2)
    spreads.push(page + 1 < count ? [page, page + 1] : [page]);
  return spreads;
}

/** 页码所在的组；越界时夹到首组或末组，空书返回 0。 */
export function spreadIndexOf(
  spreads: readonly (readonly number[])[],
  page: number,
): number {
  const index = spreads.findIndex((spread) => spread.includes(page));
  if (index !== -1) return index;
  return page > 0 ? Math.max(0, spreads.length - 1) : 0;
}

/** 保存进度用的页码：含末页的一组记为末页，便于判定读完；其余记为该组首页。 */
export function spreadAnchor(
  spread: readonly number[],
  pageCount: number,
): number {
  return spread.includes(pageCount - 1) ? pageCount - 1 : (spread[0] ?? 0);
}

/** 屏幕上从左到右的显示顺序；从右向左阅读时右侧是前一页。 */
export function spreadDisplayOrder(
  spread: readonly number[],
  direction: ReadingDirection,
): number[] {
  return direction === 'rtl' ? [...spread].reverse() : [...spread];
}
