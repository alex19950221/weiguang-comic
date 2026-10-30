import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import {
  clampPage,
  progressAnchor,
  openReading,
  saveReadingProgress,
  ProgressWriter,
} from './progress';

describe('正式阅读进度定位', () => {
  it.each([
    [0, 6, 0, 0],
    [3, 6, 3, 3],
    [4, 6, 4, 5],
    [5, 6, 5, 5],
    [99, 6, 5, 5],
    [-3, 6, 0, 0],
    [2.8, 6, 2, 2],
    [NaN, 6, 0, 0],
    [Infinity, 6, 0, 0],
    [0, 2, 0, 1],
    [0, 1, 0, 0],
    [3, 0, 0, 0],
    [3, Infinity, 0, 0],
    [4, 4.9, 3, 3],
  ])(
    '页码 %s / 页数 %s 的显示定位及末两页锚点',
    (page, count, restored, anchor) => {
      expect(clampPage(page, count)).toBe(restored);
      expect(progressAnchor(page, count)).toBe(anchor);
    },
  );
});

describe('M1 正式阅读会话与进度事务', () => {
  let db: ComicDatabase;
  beforeEach(async () => {
    db = createDatabase('reader-progress-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await db.open();
    const book = testBook({ pageCount: 6 });
    await db.books.add(book);
    await db.pageLists.add({
      bookId: book.id,
      pages: [4, 8, 15, 16, 23, 42].map((entry, index) => ({
        entry,
        name: `${index + 1}.jpg`,
      })),
      updatedAt: 1,
    });
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });

  it('打开未读书籍不写进度，保留真实页目录条目和默认设置', async () => {
    const session = await openReading(db, 'book-1');
    expect(session.page).toBe(0);
    expect(session.pages.map((page) => page.entry)).toEqual([
      4, 8, 15, 16, 23, 42,
    ]);
    expect(session.guideSeen).toBe(false);
    expect(session.defaults).toEqual({
      direction: 'ltr',
      mode: 'paged',
      background: 'system',
    });
    expect(await db.progress.count()).toBe(0);
    expect((await db.books.get('book-1'))?.lastReadAt).toBeNull();
  });
  it('重开读取持久化页码、阅读设置和已看过的说明，不覆盖原进度', async () => {
    const saved = { bookId: 'book-1', page: 3, offset: 0.4, updatedAt: 100 };
    await db.progress.put(saved);
    await db.settings.put({
      key: 'reader.defaults',
      value: { direction: 'rtl', mode: 'scroll', background: 'black' },
    });
    await db.settings.put({ key: 'reader.tap-hint-seen', value: true });
    db.close();
    await db.open();
    const session = await openReading(db, 'book-1');
    expect(session.page).toBe(3);
    expect(session.guideSeen).toBe(true);
    expect(session.defaults.direction).toBe('rtl');
    expect(await db.progress.get('book-1')).toEqual(saved);
  });
  it('恢复越界页码时仅夹到合法显示页，不直接改写旧数据', async () => {
    await db.progress.put({
      bookId: 'book-1',
      page: 900,
      offset: 0,
      updatedAt: 100,
    });
    expect((await openReading(db, 'book-1')).page).toBe(5);
    expect((await db.progress.get('book-1'))?.page).toBe(900);
  });
  it('书目缺失、不可用或目录不完整时明确拒绝打开，不生成进度', async () => {
    await expect(openReading(db, 'missing')).rejects.toMatchObject({
      code: 'BOOK_MISSING',
    });
    await db.books.update('book-1', { status: 'missing' });
    await expect(openReading(db, 'book-1')).rejects.toMatchObject({
      code: 'BOOK_UNAVAILABLE',
    });
    await db.books.update('book-1', { status: 'ready', pageCount: 7 });
    await expect(openReading(db, 'book-1')).rejects.toMatchObject({
      code: 'PAGE_LIST_UNAVAILABLE',
    });
    await db.pageLists.delete('book-1');
    await expect(openReading(db, 'book-1')).rejects.toMatchObject({
      code: 'PAGE_LIST_UNAVAILABLE',
    });
    expect(await db.progress.count()).toBe(0);
  });
  it('进度和最近阅读时间同事务更新，倒退翻页与时钟回拨也可保存', async () => {
    await saveReadingProgress(db, 'book-1', 2, 100);
    expect(await db.progress.get('book-1')).toEqual({
      bookId: 'book-1',
      page: 2,
      offset: 0,
      updatedAt: 100,
    });
    expect((await db.books.get('book-1'))?.lastReadAt).toBe(100);
    await saveReadingProgress(db, 'book-1', 1, 50);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 1,
      updatedAt: 101,
    });
    expect((await db.books.get('book-1'))?.lastReadAt).toBe(101);
  });
  it('读到倒数第二页保存为末页，重开后可判定已读完', async () => {
    await saveReadingProgress(db, 'book-1', 4, 100);
    expect((await db.progress.get('book-1'))?.page).toBe(5);
    db.close();
    await db.open();
    expect((await openReading(db, 'book-1')).page).toBe(5);
  });
  it('更新书目失败时进度与阅读时间一起回滚', async () => {
    db.books.hook('updating', () => {
      throw new Error('模拟存储失败');
    });
    await expect(saveReadingProgress(db, 'book-1', 2, 100)).rejects.toThrow(
      '模拟存储失败',
    );
    expect(await db.progress.count()).toBe(0);
    expect((await db.books.get('book-1'))?.lastReadAt).toBeNull();
  });
  it('已删除书籍不会因迟到保存复活，也不会产生孤立进度', async () => {
    await db.books.delete('book-1');
    await saveReadingProgress(db, 'book-1', 2, 100);
    expect(await db.books.count()).toBe(0);
    expect(await db.progress.count()).toBe(0);
  });
  it('连续显示请求按顺序写入，退出 flush 等待最后一次位置持久化', async () => {
    const writer = new ProgressWriter(db, 'book-1');
    const first = writer.record(1);
    const second = writer.record(3);
    const last = writer.record(0);
    await writer.flush();
    await Promise.all([first, second, last]);
    expect((await db.progress.get('book-1'))?.page).toBe(0);
    db.close();
    await db.open();
    expect((await openReading(db, 'book-1')).page).toBe(0);
  });
  it('保存失败由 flush 暴露，重试后恢复，后续页不被旧失败阻断', async () => {
    const fail = () => {
      throw new Error('模拟失败');
    };
    db.progress.hook('creating', fail);
    const writer = new ProgressWriter(db, 'book-1');
    await expect(writer.record(2)).rejects.toThrow('模拟失败');
    await expect(writer.flush()).rejects.toThrow('模拟失败');
    db.progress.hook('creating').unsubscribe(fail);
    await writer.retry();
    expect((await db.progress.get('book-1'))?.page).toBe(2);
    await writer.record(3);
    expect((await db.progress.get('book-1'))?.page).toBe(3);
  });
});
