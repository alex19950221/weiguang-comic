export function readerBrightness(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(30, value)))
    : 100;
}
export const dimmingOpacity = (value: number | undefined) =>
  (100 - readerBrightness(value)) / 140;
/** 双页按最长一侧计算画面高度，完整显示模式保留视口尺寸。 */
export function folioHeight(
  width: number,
  height: number,
  ratios: readonly number[],
  fit: 'page' | 'width',
): number {
  if (fit === 'page') return height;
  const longest = Math.max(
    0,
    ...ratios.map((ratio) =>
      Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5,
    ),
  );
  return Math.max(height, (width / Math.max(1, ratios.length)) * longest);
}
