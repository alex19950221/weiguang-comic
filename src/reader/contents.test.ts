import { describe, it, expect } from 'vitest';
import { contentsSections, contentsRange } from './contents';
import { readerBrightness, dimmingOpacity, folioHeight } from './appearance';
const pages = (names: string[]) =>
  names.map((name, entry) => ({ name, entry }));
describe('真实包内目录与分页', () => {
  it('平铺页面、空目录和单一公共目录不虚构章节', () => {
    expect(contentsSections([])).toEqual([]);
    expect(contentsSections(pages(['1.jpg', '2.jpg']))).toEqual([]);
    expect(
      contentsSections(pages(['书名/卷一/1.jpg', '书名/卷一/2.jpg'])),
    ).toEqual([]);
  });
  it('去掉公共前缀后保留真实子文件夹与准确页码', () => {
    expect(
      contentsSections(
        pages(['书名/第1章/1.jpg', '书名/第1章/2.jpg', '书名/第2章/3.jpg']),
      ),
    ).toEqual([
      { path: '第1章', start: 0, end: 1 },
      { path: '第2章', start: 2, end: 2 },
    ]);
  });
  it('混合未分章页面、嵌套目录和反斜线均按原顺序定位', () => {
    expect(
      contentsSections(
        pages(['卷/封面.jpg', '卷/正篇/一/1.jpg', '卷\\正篇\\二\\2.jpg']),
      ),
    ).toEqual([
      { path: '', start: 0, end: 0 },
      { path: '正篇/一', start: 1, end: 1 },
      { path: '正篇/二', start: 2, end: 2 },
    ]);
  });
  it('重复出现的目录不合并跨越其他页面，也不改动原数组', () => {
    const input = pages(['a/1.jpg', 'b/2.jpg', 'a/3.jpg']);
    const original = JSON.stringify(input);
    expect(contentsSections(input).map((section) => section.start)).toEqual([
      0, 1, 2,
    ]);
    expect(JSON.stringify(input)).toBe(original);
  });
  it('缩略图分段覆盖边界、末组和越界页码', () => {
    expect(contentsRange(47, 100)).toEqual({ start: 0, end: 48 });
    expect(contentsRange(48, 100)).toEqual({ start: 48, end: 96 });
    expect(contentsRange(999, 100)).toEqual({ start: 96, end: 100 });
    expect(contentsRange(-3, 100)).toEqual({ start: 0, end: 48 });
    expect(contentsRange(NaN, 0)).toEqual({ start: 0, end: 0 });
  });
});
describe('阅读适应与亮度', () => {
  it('旧值缺省、异常值和亮度上下界始终可读', () => {
    expect([undefined, NaN, 20, 64.6, 200].map(readerBrightness)).toEqual([
      100, 100, 30, 65, 100,
    ]);
    expect(dimmingOpacity(30)).toBe(0.5);
    expect(dimmingOpacity(100)).toBe(0);
  });
  it('适应宽度完整保留长条高度，双页使用最长一侧且不缩小短画面', () => {
    expect(folioHeight(375, 812, [6], 'width')).toBe(2250);
    expect(folioHeight(1280, 900, [1.5, 6], 'width')).toBe(3840);
    expect(folioHeight(375, 812, [0.5], 'width')).toBe(812);
    expect(folioHeight(375, 812, [6], 'page')).toBe(812);
  });
});
