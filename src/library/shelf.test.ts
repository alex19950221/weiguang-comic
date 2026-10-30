import { describe, expect, it } from 'vitest';
import type { Progress } from '@/db/models';
import { testBook, testSeries } from '@/db/testing/records';
import {
  buildShelf,
  selectShelf,
  continuingBooks,
  bookPercent,
  type ShelfOptions,
} from './shelf';
const options: ShelfOptions = {
  group: 'all',
  favorites: false,
  recent: false,
  filter: 'all',
  query: '',
  sort: 'lastReadAt',
};
const progress = (items: readonly [string, number, number][]) =>
  new Map(
    items.map(([bookId, page, updatedAt]) => [
      bookId,
      { bookId, page, offset: 0, updatedAt } satisfies Progress,
    ]),
  );

describe('M1-05 正式书架视图', () => {
  it('按持久化系列归组，卷和话按数值排序，隐藏系列不出现在书架', () => {
    const series = testSeries();
    const hidden = testSeries({ id: 'hidden', key: 'hidden', hidden: true });
    const entries = buildShelf(
      [
        testBook({ id: 'v10', seriesId: series.id, volume: 10 }),
        testBook({ id: 'v2', seriesId: series.id, volume: 2 }),
        testBook({ id: 'h', seriesId: hidden.id }),
      ],
      [series, hidden],
      progress([]),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]?.books.map((book) => book.id)).toEqual(['v2', 'v10']);
    const chapters = buildShelf(
      [
        testBook({ id: 'ch10', unit: '话', chapter: 10, seriesId: series.id }),
        testBook({ id: 'ch2', unit: '话', chapter: 2, seriesId: series.id }),
      ],
      [series],
      progress([]),
    );
    expect(chapters[0]?.books.map((book) => book.id)).toEqual(['ch2', 'ch10']);
  });
  it('封面优先最近在读卷，其次第一本未完成；全部完成后回到首卷', () => {
    const series = testSeries();
    const books = [1, 2, 3].map((volume) =>
      testBook({ id: `v${volume}`, seriesId: series.id, volume }),
    );
    expect(
      buildShelf(
        books,
        [series],
        progress([
          ['v2', 2, 100],
          ['v3', 3, 200],
        ]),
      )[0]?.current.id,
    ).toBe('v3');
    expect(
      buildShelf(books, [series], progress([['v1', 11, 100]]))[0]?.current.id,
    ).toBe('v2');
    const finished = buildShelf(
      books,
      [series],
      progress(books.map((book) => [book.id, 11, 100])),
    )[0]!;
    expect(finished.current.id).toBe('v1');
    expect(finished.state).toBe('finished');
    expect(finished.finished).toBe(3);
  });
  it('混合未读和已读完卷的系列属于阅读中，不误标整个系列读完', () => {
    const series = testSeries();
    const entries = buildShelf(
      [
        testBook({ id: 'a', seriesId: series.id }),
        testBook({ id: 'b', seriesId: series.id }),
      ],
      [series],
      progress([['a', 11, 100]]),
    );
    expect(entries[0]?.state).toBe('reading');
    expect(
      selectShelf(entries, { ...options, filter: 'reading' }).counts,
    ).toEqual({ all: 1, reading: 1, unread: 0, finished: 0 });
  });
  it('分组和收藏限定计数，搜索匹配保留的原文件名并忽略全半角与大小写', () => {
    const series = [
      testSeries({ groupId: 'g', favoritedAt: 0 }),
      testSeries({ id: 's2', key: 'other', groupId: null }),
    ];
    const entries = buildShelf(
      [
        testBook({ seriesId: 'series-1', fileName: 'Ｓｃｉ Ｆｉ Vol.02.cbz' }),
        testBook({ id: 'b2', seriesId: 's2' }),
      ],
      series,
      progress([]),
    );
    const result = selectShelf(entries, {
      ...options,
      group: 'g',
      favorites: true,
      query: 'SCI FI',
    });
    expect(result.visible).toHaveLength(1);
    expect(result.favoriteCount).toBe(1);
    expect(result.counts.all).toBe(1);
    expect(
      selectShelf(entries, { ...options, group: 'none' }).visible[0]?.series.id,
    ).toBe('s2');
    expect(
      selectShelf(entries, { ...options, group: 'g', query: '不存在' }).visible,
    ).toEqual([]);
  });
  it('最近阅读只展示有真实阅读时间的系列，忽略其他排序选择', () => {
    const series = [
      testSeries(),
      testSeries({ id: 's2', key: 's2' }),
      testSeries({ id: 's3', key: 's3' }),
    ];
    const books = series.map((item, index) =>
      testBook({ id: `b${index}`, seriesId: item.id, importedAt: 900 - index }),
    );
    const entries = buildShelf(
      books,
      series,
      progress([
        ['b0', 1, 100],
        ['b1', 11, 200],
      ]),
    );
    expect(
      selectShelf(entries, {
        ...options,
        recent: true,
        sort: 'title',
      }).visible.map((entry) => entry.series.id),
    ).toEqual(['s2', 'series-1']);
  });
  it('书名使用自然排序，导入排序与最近阅读排序各自生效', () => {
    const series = [
      testSeries({ title: '系列10' }),
      testSeries({ id: 's2', key: 's2', title: '系列2' }),
    ];
    const entries = buildShelf(
      [
        testBook({ id: 'a', seriesId: series[0]!.id, importedAt: 20 }),
        testBook({ id: 'b', seriesId: 's2', importedAt: 10 }),
      ],
      series,
      progress([]),
    );
    expect(
      selectShelf(entries, { ...options, sort: 'title' }).visible.map(
        (entry) => entry.series.title,
      ),
    ).toEqual(['系列2', '系列10']);
    expect(
      selectShelf(entries, { ...options, sort: 'importedAt' }).visible[0]
        ?.series.title,
    ).toBe('系列10');
  });
  it('继续阅读最多三本，按真实进度时间排列，排除未读、完成及隐藏系列', () => {
    const series = testSeries();
    const hidden = testSeries({ id: 'hidden', hidden: true, key: 'hidden' });
    const books = Array.from({ length: 6 }, (_, i) =>
      testBook({ id: `b${i}`, seriesId: i === 5 ? 'hidden' : series.id }),
    );
    const p = progress(
      books.map((book, i) => [book.id, i === 4 ? 11 : 2, i + 1]),
    );
    expect(
      continuingBooks(buildShelf(books, [series, hidden], p), p).map(
        (book) => book.id,
      ),
    ).toEqual(['b3', 'b2', 'b1']);
    expect(bookPercent(books[0]!, progress([]))).toBe(0);
    expect(
      bookPercent(testBook({ pageCount: 0 }), progress([['book-1', 0, 1]])),
    ).toBe(0);
  });
});
