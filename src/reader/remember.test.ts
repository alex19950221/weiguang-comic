import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, it, expect } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import { openReading, saveReadingProgress, ProgressWriter } from './progress';
import { saveReaderPreferences } from './preferences';
import { toggleBookmark } from './bookmarks';

describe('记住阅读位置策略与数据库闸门', () => {
  let db: ComicDatabase;
  beforeEach(async () => {
    db = createDatabase('reader-remember-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await db.open();
    await db.books.add(testBook({ pageCount: 10 }));
    await db.pageLists.put({
      bookId: 'book-1',
      pages: Array.from({ length: 10 }, (_, entry) => ({
        entry,
        name: `${entry}.jpg`,
      })),
      updatedAt: 1,
    });
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });
  it('旧库默认保存；关闭后保留旧进度、页内位置和最近时间', async () => {
    await saveReadingProgress(db, 'book-1', 3, 100, 0.4);
    const saved = await db.progress.get('book-1');
    await saveReaderPreferences(db, 'book-1', { remember: false });
    await saveReadingProgress(db, 'book-1', 7, 200, 0.8);
    expect(await db.progress.get('book-1')).toEqual(saved);
    expect((await db.books.get('book-1'))?.lastReadAt).toBe(100);
    db.close();
    await db.open();
    expect(await openReading(db, 'book-1')).toMatchObject({
      page: 3,
      offset: 0.4,
      defaults: { remember: false },
    });
  });
  it('未读书关闭后不产生记录，重新开启后才保存当前显示页', async () => {
    await saveReaderPreferences(db, 'book-1', { remember: false });
    await saveReadingProgress(db, 'book-1', 4);
    expect(await db.progress.count()).toBe(0);
    expect((await db.books.get('book-1'))?.lastReadAt).toBeNull();
    await saveReaderPreferences(db, 'book-1', { remember: true });
    await saveReadingProgress(db, 'book-1', 5, 100, 0.3);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 5,
      offset: 0.3,
    });
  });
  it('暂停后等待写入失效，重试不会偷偷写旧位置，恢复可继续写', async () => {
    const writer = new ProgressWriter(db, 'book-1');
    const first = writer.record(1),
      next = writer.record(2);
    await writer.setRemember(false);
    await Promise.all([first, next]);
    await writer.record(4);
    await writer.retry();
    expect(await db.progress.count()).toBe(0);
    await writer.setRemember(true);
    await writer.record(6, 0.5);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 6,
      offset: 0.5,
    });
  });
  it('关闭时清理旧保存错误，不再因旧失败阻止退出', async () => {
    const fail = () => {
      throw new Error('模拟失败');
    };
    db.progress.hook('creating', fail);
    const writer = new ProgressWriter(db, 'book-1');
    await expect(writer.record(3)).rejects.toThrow('模拟失败');
    await writer.setRemember(false);
    await expect(writer.flush()).resolves.toBeUndefined();
    await expect(writer.retry()).resolves.toBeUndefined();
    expect(await db.progress.count()).toBe(0);
    db.progress.hook('creating').unsubscribe(fail);
    await writer.setRemember(true);
    await writer.record(4);
    expect((await db.progress.get('book-1'))?.page).toBe(4);
  });
  it('其他会话关闭保存时，旧写队列也受同事务设置闸门保护', async () => {
    const staleWriter = new ProgressWriter(db, 'book-1');
    await saveReaderPreferences(db, 'book-1', { remember: false });
    await staleWriter.record(5);
    expect(await db.progress.count()).toBe(0);
    expect((await db.books.get('book-1'))?.lastReadAt).toBeNull();
  });
  it('设置写入失败不关闭保存，也不覆盖已有记录', async () => {
    const fail = () => {
      throw new Error('设置失败');
    };
    db.settings.hook('updating', fail);
    await expect(
      saveReaderPreferences(db, 'book-1', { remember: false }),
    ).rejects.toThrow('设置失败');
    db.settings.hook('updating').unsubscribe(fail);
    expect((await openReading(db, 'book-1')).defaults.remember).toBeUndefined();
    await saveReadingProgress(db, 'book-1', 2, 100);
    expect((await db.progress.get('book-1'))?.page).toBe(2);
  });
  it('关闭保存与相邻写入串行，关闭提交后不再更新进度', async () => {
    await Promise.all([
      saveReadingProgress(db, 'book-1', 1, 100),
      saveReaderPreferences(db, 'book-1', { remember: false }),
      saveReadingProgress(db, 'book-1', 2, 200),
    ]);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 1,
      updatedAt: 100,
    });
  });
  it('关闭自动进度仍可明确添加书签，书签不会写入进度', async () => {
    await saveReaderPreferences(db, 'book-1', { remember: false });
    await toggleBookmark(db, 'book-1', { page: 8, offset: 0.6 });
    expect((await db.bookmarks.toArray())[0]).toMatchObject({
      page: 8,
      offset: 0.6,
    });
    expect(await db.progress.count()).toBe(0);
  });
});
