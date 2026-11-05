import { describe, expect, it } from 'vitest';
import { testBook, testSeries } from '@/db/testing/records';
import { targetTitle } from './LibraryDialogs';

describe('删除确认标题', () => {
  const series = testSeries({ title: '海边小镇' });
  const first = testBook({ id: 'b1', volume: 1 });
  const second = testBook({ id: 'b2', volume: 2 });

  it('系列中只删除一卷时写明卷号', () => {
    expect(
      targetTitle(
        { kind: 'book', id: 'b2' },
        { series, books: [first, second] },
        second,
      ),
    ).toBe('海边小镇 第 2 卷');
  });

  it('删除整个系列或单本书时只写书名', () => {
    expect(
      targetTitle(
        { kind: 'series', id: series.id },
        { series, books: [first, second] },
        first,
      ),
    ).toBe('海边小镇');
    expect(
      targetTitle(
        { kind: 'book', id: 'b1' },
        { series, books: [first] },
        first,
      ),
    ).toBe('海边小镇');
  });
});
