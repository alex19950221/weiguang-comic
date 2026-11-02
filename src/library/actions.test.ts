import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook, testSeries } from '@/db/testing/records';
import {
  deleteLibraryTarget,
  markTargetRead,
  setSeriesHidden,
  toggleSeriesFavorite,
} from './actions';
import { FileCleanupQueue } from './FileCleanupQueue';

let db: ComicDatabase;
beforeEach(async () => {
  db = createDatabase('shelf-actions-test', {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});
async function seed() {
  const series = testSeries({ groupId: 'g', favoritedAt: 5 });
  const books = [
    testBook({ seriesId: series.id }),
    testBook({
      id: 'book-2',
      seriesId: series.id,
      fingerprint: 'b'.repeat(64),
      volume: 2,
    }),
  ];
  await db.series.add(series);
  await db.books.bulkAdd(books);
  for (const book of books) {
    await db.pageLists.add({
      bookId: book.id,
      pages: [{ entry: 1, name: '01.jpg' }],
      updatedAt: 1,
    });
    await db.progress.add({
      bookId: book.id,
      page: 2,
      offset: 0.2,
      updatedAt: 2,
    });
    await db.bookmarks.add({
      bookId: book.id,
      id: `mark-${book.id}`,
      page: 2,
      offset: 0.2,
      note: '保留笔记',
      createdAt: 2,
      updatedAt: 2,
    });
    await db.imports.add({
      id: `job-${book.id}`,
      bookId: book.id,
      source: {
        uri: 'test',
        name: book.fileName!,
        size: 123,
        isDirectory: false,
      },
      state: 'done',
      copiedBytes: 123,
      path: book.path,
      error: null,
      createdAt: 1,
      updatedAt: 1,
    });
  }
  return { series, books };
}
describe('M1-05 书架事务与原生副本清理', () => {
  it('隐藏与取消隐藏系列只改该系列，缺系列时报错', async () => {
    const { series } = await seed();
    await setSeriesHidden(db, series.id, true);
    expect((await db.series.get(series.id))?.hidden).toBe(true);
    await setSeriesHidden(db, series.id, false);
    await setSeriesHidden(db, series.id, false);
    expect((await db.series.get(series.id))?.hidden).toBe(false);
    expect(await db.books.count()).toBeGreaterThan(0);
    await expect(setSeriesHidden(db, 'missing', true)).rejects.toThrow(
      'SERIES_MISSING',
    );
  });
  it('按系列标记读完保存末页，标记未读清掉进度和阅读时间，保留书签', async () => {
    const { series, books } = await seed();
    await markTargetRead(db, { kind: 'series', id: series.id }, true);
    expect((await db.progress.toArray()).map((p) => p.page)).toEqual([11, 11]);
    expect(
      (await db.books.toArray()).every((book) => book.lastReadAt !== null),
    ).toBe(true);
    await markTargetRead(db, { kind: 'book', id: books[0]!.id }, false);
    expect(await db.progress.get(books[0]!.id)).toBeUndefined();
    expect((await db.books.get(books[0]!.id))?.lastReadAt).toBeNull();
    expect(await db.bookmarks.count()).toBe(2);
    expect(await db.progress.get('book-2')).toBeDefined();
  });
  it('标记多个书目失败时，所有阅读时间及进度一起回滚', async () => {
    const { series, books } = await seed();
    const before = await db.progress.toArray();
    db.progress.hook('updating', (_changes, key) => {
      if (key === 'book-2') throw new Error('模拟保存失败');
    });
    await expect(
      markTargetRead(db, { kind: 'series', id: series.id }, true),
    ).rejects.toThrow('模拟保存失败');
    expect(await db.books.toArray()).toEqual(books);
    expect(await db.progress.toArray()).toEqual(before);
  });
  it('并发收藏切换串行执行，保留系列的分组和隐藏属性', async () => {
    const series = testSeries({ hidden: true, groupId: 'g' });
    await db.series.add(series);
    await Promise.all([
      toggleSeriesFavorite(db, series.id),
      toggleSeriesFavorite(db, series.id),
    ]);
    expect(await db.series.get(series.id)).toMatchObject({
      favoritedAt: null,
      groupId: 'g',
      hidden: true,
    });
  });
  it('删除单本原子清理关联行，保留同系列其他卷，事务后再由原生删副本', async () => {
    const { series, books } = await seed();
    const first = books[0]!;
    await deleteLibraryTarget(db, { kind: 'book', id: first.id });
    expect(await db.books.get(first.id)).toBeUndefined();
    expect(await db.pageLists.get(first.id)).toBeUndefined();
    expect(await db.progress.get(first.id)).toBeUndefined();
    expect(await db.bookmarks.where('bookId').equals(first.id).count()).toBe(0);
    expect(await db.imports.where('bookId').equals(first.id).count()).toBe(0);
    expect(await db.books.get('book-2')).toEqual(books[1]);
    expect(await db.series.get(series.id)).toEqual(series);
    const disposeBook = vi.fn(
      async ({ bookId }: { bookId: string; deleteCopy: boolean }) => {
        expect(await db.books.get(bookId)).toBeUndefined();
        expect(await db.fileCleanup.get(bookId)).toBeDefined();
      },
    );
    await new FileCleanupQueue(db, { disposeBook }).drain();
    expect(disposeBook).toHaveBeenCalledExactlyOnceWith({
      bookId: first.id,
      deleteCopy: true,
    });
    expect(await db.fileCleanup.count()).toBe(0);
  });
  it('删除整个系列用事务当时的全部卷，空系列移除，分组不删除', async () => {
    const { series } = await seed();
    await db.libraryGroups.add({
      id: 'g',
      name: '保留分组',
      nameKey: '保留分组',
      order: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    await deleteLibraryTarget(db, { kind: 'series', id: series.id });
    for (const table of [
      db.books,
      db.series,
      db.pageLists,
      db.progress,
      db.bookmarks,
      db.imports,
    ])
      expect(await table.count()).toBe(0);
    expect(await db.fileCleanup.count()).toBe(2);
    expect(await db.libraryGroups.get('g')).toBeDefined();
    await deleteLibraryTarget(db, { kind: 'series', id: series.id });
    expect(await db.fileCleanup.count()).toBe(2);
  });
  it('删除事务中途失败，书籍、关联行和清理任务一起回滚', async () => {
    const { series, books } = await seed();
    const progress = await db.progress.toArray();
    db.pageLists.hook('deleting', () => {
      throw new Error('模拟数据库失败');
    });
    await expect(
      deleteLibraryTarget(db, { kind: 'series', id: series.id }),
    ).rejects.toThrow('模拟数据库失败');
    expect(await db.books.toArray()).toEqual(books);
    expect(await db.series.get(series.id)).toEqual(series);
    expect(await db.progress.toArray()).toEqual(progress);
    expect(await db.pageLists.count()).toBe(2);
    expect(await db.imports.count()).toBe(2);
    expect(await db.bookmarks.count()).toBe(2);
    expect(await db.fileCleanup.count()).toBe(0);
  });
  it('原位文件只清缓存，不要求原生删除文件', async () => {
    const { books } = await seed();
    await db.books.update(books[0]!.id, { location: 'inplace' });
    await deleteLibraryTarget(db, { kind: 'book', id: books[0]!.id });
    const disposeBook = vi.fn(async () => undefined);
    await new FileCleanupQueue(db, { disposeBook }).drain();
    expect(disposeBook).toHaveBeenCalledExactlyOnceWith({
      bookId: books[0]!.id,
      deleteCopy: false,
    });
  });
  it('原生失败保留已移除书目的清理任务，重开后重试并幂等完成', async () => {
    const { books } = await seed();
    await deleteLibraryTarget(db, { kind: 'book', id: books[0]!.id });
    const disposeBook = vi
      .fn(async () => undefined)
      .mockRejectedValueOnce(new Error('原生删除失败'));
    await new FileCleanupQueue(db, { disposeBook }).drain();
    expect(await db.fileCleanup.get(books[0]!.id)).toMatchObject({
      state: 'failed',
      attempts: 1,
      error: 'CLEANUP_FAILED',
    });
    db.close();
    await db.open();
    expect(await db.books.get(books[0]!.id)).toBeUndefined();
    await new FileCleanupQueue(db, { disposeBook }).drain();
    expect(await db.fileCleanup.count()).toBe(0);
    expect(disposeBook).toHaveBeenCalledTimes(2);
  });
  it('并发清理调用共享一轮，成功任务不会重复调用原生', async () => {
    await seed();
    await deleteLibraryTarget(db, { kind: 'series', id: 'series-1' });
    const disposeBook = vi.fn(async () => undefined);
    const queue = new FileCleanupQueue(db, { disposeBook });
    await Promise.all([queue.drain(), queue.drain()]);
    expect(disposeBook).toHaveBeenCalledTimes(2);
    expect(await db.fileCleanup.count()).toBe(0);
  });

  it('删除同步清除同指纹待匹配备份，保留其他待匹配数据', async () => {
    const { books } = await seed();
    const { id, path, location, status, ...backupBook } = books[0]!;
    void id;
    void path;
    void location;
    void status;
    const pending = {
      fingerprint: backupBook.fingerprint,
      book: backupBook,
      progress: null,
      bookmarks: [],
      updatedAt: 10,
    };
    await db.pendingMatches.bulkPut([
      pending,
      { ...pending, fingerprint: 'c'.repeat(64) },
    ]);
    await deleteLibraryTarget(db, { kind: 'book', id: books[0]!.id });
    expect(await db.pendingMatches.get(backupBook.fingerprint)).toBeUndefined();
    expect(await db.pendingMatches.get('c'.repeat(64))).toBeDefined();
  });

  it('一个副本清理失败不阻塞其他任务，下轮只重试失败项', async () => {
    await seed();
    await deleteLibraryTarget(db, { kind: 'series', id: 'series-1' });
    const disposeBook = vi
      .fn(async () => undefined)
      .mockRejectedValueOnce(new Error('模拟原生失败'));
    const queue = new FileCleanupQueue(db, { disposeBook });
    await queue.drain();
    expect(disposeBook).toHaveBeenCalledTimes(2);
    expect(await db.fileCleanup.count()).toBe(1);
    await queue.drain();
    expect(disposeBook).toHaveBeenCalledTimes(3);
    expect(await db.fileCleanup.count()).toBe(0);
  });
});
