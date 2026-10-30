/** IntersectionObserver 的百分比边距按宽度计算；用像素保持横竖屏均为视口中线。 */
export function centerBandRootMargin(height: number): string {
  const inset = Number.isFinite(height)
    ? Math.max(0, Math.floor(height / 2) - 1)
    : 0;
  return `-${inset}px 0px -${inset}px 0px`;
}
