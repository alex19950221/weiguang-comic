import type { ReadingDirection } from './spread';

export type TapAction = 'previous' | 'next' | 'menu';

/** 左右各 30% 翻页、中间呼出工具栏；从右向左阅读时左侧是下一页。条漫只呼出工具栏。 */
export function tapAction(
  ratio: number,
  direction: ReadingDirection,
  scroll: boolean,
): TapAction {
  if (scroll || !Number.isFinite(ratio) || (ratio >= 0.3 && ratio <= 0.7))
    return 'menu';
  const left = ratio < 0.3;
  return left === (direction === 'rtl') ? 'next' : 'previous';
}
