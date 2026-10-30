import { describe, expect, it } from 'vitest';
import {
  buildSpreads,
  spreadAnchor,
  spreadDisplayOrder,
  spreadIndexOf,
} from './spread';
import { tapAction } from './tapZones';

describe('双页配对', () => {
  it('封面单独时从第 2 页起两两成对，末尾单页保留', () => {
    expect(buildSpreads(6, 'alone')).toEqual([[0], [1, 2], [3, 4], [5]]);
    expect(buildSpreads(5, 'alone')).toEqual([[0], [1, 2], [3, 4]]);
  });

  it('封面拼合时从第 1 页起两两成对', () => {
    expect(buildSpreads(5, 'paired')).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('空书或异常页数不产生配对', () => {
    expect(buildSpreads(0, 'alone')).toEqual([]);
    expect(buildSpreads(Number.NaN, 'paired')).toEqual([]);
    expect(spreadIndexOf([], 3)).toBe(0);
  });

  it('从任意页进入都落在所属的一组，越界夹到首末组', () => {
    const spreads = buildSpreads(12, 'alone');
    expect(spreadIndexOf(spreads, 0)).toBe(0);
    expect(spreadIndexOf(spreads, 3)).toBe(2);
    expect(spreadIndexOf(spreads, 4)).toBe(2);
    expect(spreadIndexOf(spreads, 11)).toBe(6);
    expect(spreadIndexOf(spreads, 40)).toBe(6);
    expect(spreadIndexOf(spreads, -1)).toBe(0);
  });

  it('含末页的一组按末页记进度，其余记首页', () => {
    expect(spreadAnchor([3, 4], 12)).toBe(3);
    expect(spreadAnchor([10, 11], 12)).toBe(11);
    expect(spreadAnchor([11], 12)).toBe(11);
  });

  it('从右向左阅读时前一页显示在右侧', () => {
    expect(spreadDisplayOrder([1, 2], 'ltr')).toEqual([1, 2]);
    expect(spreadDisplayOrder([1, 2], 'rtl')).toEqual([2, 1]);
    expect(spreadDisplayOrder([0], 'rtl')).toEqual([0]);
  });
});

describe('点按分区', () => {
  it('左右 30% 翻页，中间呼出工具栏', () => {
    expect(tapAction(0.1, 'ltr', false)).toBe('previous');
    expect(tapAction(0.5, 'ltr', false)).toBe('menu');
    expect(tapAction(0.9, 'ltr', false)).toBe('next');
    expect(tapAction(0.3, 'ltr', false)).toBe('menu');
    expect(tapAction(0.7, 'ltr', false)).toBe('menu');
  });

  it('从右向左阅读时左右对调', () => {
    expect(tapAction(0.1, 'rtl', false)).toBe('next');
    expect(tapAction(0.9, 'rtl', false)).toBe('previous');
  });

  it('条漫和异常坐标只呼出工具栏', () => {
    expect(tapAction(0.9, 'ltr', true)).toBe('menu');
    expect(tapAction(Number.NaN, 'ltr', false)).toBe('menu');
  });
});
