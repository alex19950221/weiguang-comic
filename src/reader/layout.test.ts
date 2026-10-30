import { describe, expect, it } from 'vitest';
import { testBook } from '@/db/testing/records';
import {
  visiblePages,
  visibleAnchor,
  pageWindow,
  nextVolume,
  scrollLayout,
  positionAt,
  topAt,
} from './layout';
import { clampZoom, nextZoom, zoomScroll, distance } from './zoom';

describe('正式阅读器布局和窗口', () => {
  it('倒数第二页位于双页第二侧也记末页，普通组仍保存首页', () => {
    expect(visibleAnchor([3, 4], 6)).toBe(5);
    expect(visibleAnchor([1, 2], 6)).toBe(1);
    expect(visibleAnchor([4, 5], 6)).toBe(5);
    expect(visibleAnchor([0], 1)).toBe(0);
  });
  it('封面单独、末尾单张与组内定位复用双页规则', () => {
    expect(visiblePages(0, 6, 'spread', 'alone')).toEqual([0]);
    expect(visiblePages(2, 6, 'spread', 'alone')).toEqual([1, 2]);
    expect(visiblePages(5, 6, 'spread', 'alone')).toEqual([5]);
    expect(visiblePages(0, 6, 'spread', 'paired')).toEqual([0, 1]);
    expect(visiblePages(99, 6, 'spread', 'paired')).toEqual([4, 5]);
    expect(visiblePages(0, 0, 'spread', 'alone')).toEqual([]);
  });
  it('模式切换保留页码，单页与条漫均只确定一张当前页', () => {
    expect(visiblePages(3, 10, 'scroll', 'alone')).toEqual([3]);
    expect(visiblePages(3, 10, 'paged', 'paired')).toEqual([3]);
  });
  it('双页优先当前两页及后一页，总窗口不超过三张', () => {
    expect(pageWindow([3, 4], 10)).toEqual([3, 4, 5]);
    expect(pageWindow([8, 9], 10)).toEqual([8, 9, 7]);
    expect(pageWindow([0], 10)).toEqual([0, 1]);
    expect(pageWindow([4], 10)).toEqual([4, 5, 3]);
    expect(pageWindow([], 0)).toEqual([]);
  });
  it('长条、横图、未知比例均能定位；页内位置与像素坐标可往返', () => {
    const positions = scrollLayout(
      4,
      375,
      new Map([
        [0, 0.5],
        [1, 8],
        [2, NaN],
      ]),
    );
    expect(positions).toEqual([0, 187.5, 3187.5, 3750, 4312.5]);
    const position = { page: 1, offset: 0.6 };
    expect(positionAt(positions, topAt(positions, position))).toEqual(position);
  });
  it('恢复时比例或宽度改变仍保持同一页内位置', () => {
    const old = scrollLayout(3, 375, new Map());
    const position = positionAt(old, 1000);
    const resized = scrollLayout(
      3,
      900,
      new Map([
        [0, 5],
        [1, 9],
      ]),
    );
    expect(positionAt(resized, topAt(resized, position)).page).toBe(
      position.page,
    );
    expect(positionAt(resized, topAt(resized, position)).offset).toBeCloseTo(
      position.offset,
    );
  });
  it('精确边界进入下一页，越界夹到末页，不把卷末卡当漫画页', () => {
    const positions = scrollLayout(2, 100, new Map());
    expect(positionAt(positions, 150)).toEqual({ page: 1, offset: 0 });
    expect(positionAt(positions, 9999)).toEqual({ page: 1, offset: 1 });
    expect(positionAt(positions, -1)).toEqual({ page: 0, offset: 0 });
    expect(positionAt([], 10)).toEqual({ page: 0, offset: 0 });
  });
});
describe('下一卷只使用正式书目', () => {
  const current = testBook({ seriesId: 'series', volume: 1 });
  it('缺卷时选择最近的更大卷号，不依赖导入顺序，不修改传入数组', () => {
    const books = [
      testBook({ id: 'ten', seriesId: 'series', volume: 10 }),
      testBook({ id: 'three', seriesId: 'series', volume: 3 }),
    ];
    expect(nextVolume(current, books)?.id).toBe('three');
    expect(books[0]?.id).toBe('ten');
  });
  it('排除其他系列、话、不可用、无页、重复卷号及无卷号', () => {
    const books = [
      testBook({ id: 'other', seriesId: 'other', volume: 2 }),
      testBook({ id: 'chapter', seriesId: 'series', unit: '话', chapter: 2 }),
      testBook({
        id: 'missing',
        seriesId: 'series',
        volume: 2,
        status: 'missing',
      }),
      testBook({ id: 'empty', seriesId: 'series', volume: 2, pageCount: 0 }),
      testBook({ id: 'duplicate', seriesId: 'series', volume: 1 }),
      testBook({ id: 'unknown', seriesId: 'series', volume: null }),
    ];
    expect(nextVolume(current, books)).toBeUndefined();
  });
  it('按话数找下一话，不串卷号', () => {
    const chapter = testBook({
      seriesId: 'series',
      unit: '话',
      chapter: 3,
      volume: null,
    });
    expect(
      nextVolume(chapter, [
        testBook({
          id: 'next',
          seriesId: 'series',
          unit: '话',
          chapter: 5,
          volume: null,
        }),
      ])?.id,
    ).toBe('next');
  });
  it('单本或未知卷号不猜下一卷', () => {
    expect(
      nextVolume({ ...current, seriesId: null }, [current]),
    ).toBeUndefined();
    expect(nextVolume({ ...current, volume: null }, [current])).toBeUndefined();
  });
});
describe('缩放边界与焦点', () => {
  it('按钮只在100/150/200循环，捏合最多300', () => {
    expect([100, 150, 200, 275].map(nextZoom)).toEqual([150, 200, 100, 100]);
    expect([-20, 150.4, 400, NaN].map(clampZoom)).toEqual([100, 150, 300, 100]);
  });
  it('缩放保持点击处对应的内容坐标，缩小的负偏移交给边界夹取', () => {
    expect(zoomScroll(0, 100, 375, 750)).toBe(100);
    expect(zoomScroll(120, 100, 750, 375)).toBe(10);
    expect(zoomScroll(0, 100, 750, 375)).toBe(0);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
