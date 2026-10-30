export interface Point {
  x: number;
  y: number;
}
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);
export const clampZoom = (value: number) =>
  Number.isFinite(value)
    ? Math.round(Math.max(100, Math.min(300, value)))
    : 100;
export const nextZoom = (value: number) =>
  [100, 150, 200].find((step) => step > value) ?? 100;
export function zoomScroll(
  scroll: number,
  point: number,
  before: number,
  after: number,
): number {
  return before > 0
    ? Math.max(0, ((scroll + point) * after) / before - point)
    : 0;
}
