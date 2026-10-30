import { expect, it } from 'vitest';
import { centerBandRootMargin } from './viewportBand';

it('横竖屏都保留约两像素的视口中线，不依赖视口宽度', () => {
  expect(centerBandRootMargin(600)).toBe('-299px 0px -299px 0px');
  expect(centerBandRootMargin(180)).toBe('-89px 0px -89px 0px');
  expect(centerBandRootMargin(1)).toBe('-0px 0px -0px 0px');
  expect(centerBandRootMargin(Number.NaN)).toBe('-0px 0px -0px 0px');
});
