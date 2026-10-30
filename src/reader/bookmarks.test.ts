import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import { sortedBookmarks, toggleBookmark, removeBookmark } from './bookmarks';

describe('书签事务和准确位置', () => {
  let db: ComicDatabase;
  beforeEach(async () => {
    db = createDatabase('bookmarks-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await db.open();
    await db.books.add(testBook({ pageCount: 10 }));
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });
  it('书签保留倒数第二页和页内位置，不触发阅读进度或最近时间', async () => {
    await toggleBookmark(db, 'book-1', { page: 8, offset: 0.65 }, 100, 'mark');
    expect(await db.bookmarks.get('mark')).toMatchObject({
      page: 8,
      offset: 0.65,
      createdAt: 100,
    });
    expect(await db.progress.count()).toBe(0);
    expect((await db.books.get('book-1'))?.lastReadAt).toBeNull();
    db.close();
    await db.open();
    expect((await db.bookmarks.get('mark'))?.offset).toBe(0.65);
  });
  it('同页再次切换移除书签，清理旧重复项，保留其他页和其他书', async () => {
    await toggleBookmark(db, 'book-1', { page: 2, offset: 0.1 }, 100, 'first');
    const first = (await db.bookmarks.get('first'))!;
    await db.bookmarks.bulkAdd([
      { ...first, id: 'duplicate' },
      { ...first, id: 'other-page', page: 3 },
      { ...first, id: 'other-book', bookId: 'book-2' },
    ]);
    expect(await toggleBookmark(db, 'book-1', { page: 2, offset: 0.8 })).toBe(
      false,
    );
    expect(
      (await db.bookmarks.toArray()).map((mark) => mark.id).sort(),
    ).toEqual(['other-book', 'other-page']);
  });
  it('并发添加同页通过读写事务串行化，不留下重复书签', async () => {
    await Promise.all([
      toggleBookmark(db, 'book-1', { page: 1, offset: 0 }, 100, 'one'),
      toggleBookmark(db, 'book-1', { page: 1, offset: 0 }, 101, 'two'),
    ]);
    expect(await db.bookmarks.count()).toBe(0);
  });
  it('失败删除整体回滚，不留下半删的旧重复项', async () => {
    await toggleBookmark(db, 'book-1', { page: 2, offset: 0 }, 100, 'one');
    await db.bookmarks.add({ ...(await db.bookmarks.get('one'))!, id: 'two' });
    db.bookmarks.hook('deleting', (key) => {
      if (key === 'two') throw new Error('模拟失败');
    });
    await expect(
      toggleBookmark(db, 'book-1', { page: 2, offset: 0 }),
    ).rejects.toThrow('模拟失败');
    expect(await db.bookmarks.count()).toBe(2);
  });
  it('缺失、不可用或非法位置不生成书签；无效偏移归一化', async () => {
    await expect(
      toggleBookmark(db, 'missing', { page: 0, offset: 0 }),
    ).rejects.toThrow('BOOK_UNAVAILABLE');
    await expect(
      toggleBookmark(db, 'book-1', { page: 10, offset: 0 }),
    ).rejects.toThrow('INVALID_POSITION');
    await expect(
      toggleBookmark(db, 'book-1', { page: -1, offset: 0 }),
    ).rejects.toThrow('INVALID_POSITION');
    await db.books.update('book-1', { status: 'missing' });
    await expect(
      toggleBookmark(db, 'book-1', { page: 0, offset: 0 }),
    ).rejects.toThrow('BOOK_UNAVAILABLE');
    expect(await db.bookmarks.count()).toBe(0);
    await db.books.update('book-1', { status: 'ready' });
    await toggleBookmark(
      db,
      'book-1',
      { page: 1, offset: Infinity },
      100,
      'valid',
    );
    expect((await db.bookmarks.get('valid'))?.offset).toBe(0);
  });
  it('书目删除后迟到的书签请求不能复活数据', async () => {
    await db.books.delete('book-1');
    await expect(
      toggleBookmark(db, 'book-1', { page: 1, offset: 0 }),
    ).rejects.toThrow('BOOK_UNAVAILABLE');
    expect(await db.bookmarks.count()).toBe(0);
    expect(await db.books.count()).toBe(0);
  });
  it('按ID移除只作用于当前书，重复删除可安全重试', async () => {
    await toggleBookmark(db, 'book-1', { page: 2, offset: 0 }, 100, 'mark');
    await removeBookmark(db, 'other', 'mark');
    expect(await db.bookmarks.count()).toBe(1);
    await removeBookmark(db, 'book-1', 'mark');
    await removeBookmark(db, 'book-1', 'mark');
    expect(await db.bookmarks.count()).toBe(0);
  });
  it('列表过滤越界页并按准确位置排序，不修改原始记录', async () => {
    await toggleBookmark(db, 'book-1', { page: 3, offset: 0.6 }, 100, 'b');
    await toggleBookmark(db, 'book-1', { page: 1, offset: 0 }, 101, 'a');
    const marks = await db.bookmarks.toArray();
    const input = [...marks, { ...marks[0]!, id: 'old', page: 90 }];
    const original = JSON.stringify(input);
    expect(sortedBookmarks(input, 10).map((mark) => mark.id)).toEqual([
      'a',
      'b',
    ]);
    expect(JSON.stringify(input)).toBe(original);
  });
});
