import { describe, expect, it } from 'vitest';
import {
  compareTitles,
  groupBySeries,
  parseComicName,
  readingState,
  seriesKey,
  seriesReadingState,
} from './series';

describe('文件名识别系列与卷号', () => {
  it.each([
    ['山海之间 第01卷.cbz', '山海之间', 1, '卷'],
    ['[晨光社] 灯塔守望者 Vol.03 (2021) [扫图组].cbz', '灯塔守望者', 3, '卷'],
    ['孤岛日记_v12.zip', '孤岛日记', 12, '卷'],
    ['云端之上 第7话.cbz', '云端之上', 7, '话'],
    ['Midnight Bakery Ch.15.cbz', 'Midnight Bakery', 15, '话'],
    ['纸飞机 #2.cbr', '纸飞机', 2, '卷'],
    ['旧城往事 - 05.rar', '旧城往事', 5, '卷'],
    ['【汉化】星辰列车 第 2 册.zip', '星辰列车', 2, '卷'],
    ['ＶＯＬ全角 Ｖｏｌ．４.cbz', 'VOL全角', 4, '卷'],
  ])('%s', (name, title, volume, unit) => {
    expect(parseComicName(name)).toEqual({ title, volume, unit });
  });

  it('没有卷号时整体当作单本，保留年份以外的数字', () => {
    expect(parseComicName('速写本 2023.zip')).toEqual({
      title: '速写本 2023',
      volume: null,
      unit: '卷',
    });
    expect(parseComicName('我的扫描')).toEqual({
      title: '我的扫描',
      volume: null,
      unit: '卷',
    });
  });

  it('只有标注时退回原文件名', () => {
    expect(parseComicName('[2019].cbz').title).toBe('[2019]');
  });

  it('系列键忽略大小写、全半角与分隔符', () => {
    expect(seriesKey('Midnight Bakery')).toBe(seriesKey('midnight-bakery'));
    expect(seriesKey('灯塔·守望者')).toBe(seriesKey('灯塔 守望者'));
    expect(seriesKey('ＡＢＣ')).toBe('abc');
  });
});

describe('阅读状态', () => {
  it('按页码判断单本状态', () => {
    expect(readingState(undefined, 12)).toBe('unread');
    expect(readingState(0, 12)).toBe('reading');
    expect(readingState(11, 12)).toBe('finished');
  });

  it('系列全部读完或全部未读时才取对应状态', () => {
    expect(seriesReadingState(['finished', 'finished'])).toBe('finished');
    expect(seriesReadingState(['unread', 'unread'])).toBe('unread');
    expect(seriesReadingState(['finished', 'unread'])).toBe('reading');
    expect(seriesReadingState([])).toBe('unread');
  });
});

describe('按系列归组', () => {
  const describeName = (name: string) => {
    const parsed = parseComicName(name);
    return { key: seriesKey(parsed.title), volume: parsed.volume, name };
  };

  it('同名不同卷归为一组并按卷号数值排序', () => {
    const groups = groupBySeries(
      ['孤岛日记_v10.cbz', '孤岛日记_v2.cbz', '纸飞机.cbz', '孤岛日记 v1.zip'],
      describeName,
    );
    expect(groups).toEqual([
      {
        key: '孤岛日记',
        items: ['孤岛日记 v1.zip', '孤岛日记_v2.cbz', '孤岛日记_v10.cbz'],
      },
      { key: '纸飞机', items: ['纸飞机.cbz'] },
    ]);
  });

  it('无卷号的排在有卷号之后并自然排序', () => {
    const groups = groupBySeries(
      ['A 番外 10', 'A 第2卷', 'A 番外 9'].map((name) => ({ name })),
      (item) => ({
        key: 'a',
        volume: item.name.includes('第') ? 2 : null,
        name: item.name,
      }),
    );
    expect(groups[0]!.items.map((item) => item.name)).toEqual([
      'A 第2卷',
      'A 番外 9',
      'A 番外 10',
    ]);
  });

  it('书名排序使用数字自然顺序', () => {
    expect(['卷10', '卷2', '卷1'].sort(compareTitles)).toEqual([
      '卷1',
      '卷2',
      '卷10',
    ]);
  });
});
