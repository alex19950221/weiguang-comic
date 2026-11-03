import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook, testSeries } from '@/db/testing/records';
import { applyBatch, type BatchSelection } from './batch';
import { createLibraryGroup } from './groups';
import { FileCleanupQueue } from './FileCleanupQueue';

let db: ComicDatabase;
beforeEach(async () => {
  db = createDatabase('batch-test', {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

async function seed(): Promise<BatchSelection> {
  await db.series.bulkAdd([
    testSeries(),
    testSeries({ id: 's2', key: 'second' }),
  ]);
  await db.books.bulkAdd([
    testBook({ seriesId: 'series-1' }),
    testBook({
      id: 'b2',
      seriesId: 'series-1',
      fingerprint: 'b'.repeat(64),
      volume: 2,
      location: 'inplace',
    }),
    testBook({ id: 'b3', seriesId: 's2', fingerprint: 'c'.repeat(64) }),
  ]);
  await db.bookmarks.add({
    id: 'bookmark',
    bookId: 'book-1',
    page: 2,
    offset: 0,
    note: 'keep',
    createdAt: 1,
    updatedAt: 1,
  });
  return {
    targets: [
      { kind: 'series', id: 'series-1' },
      { kind: 'book', id: 'b3' },
    ],
    bookIds: ['book-1', 'b2', 'b3'],
  };
}

describe('Pro 批量整理', () => {
  it('批量标记读完/未读不删除书签，重复和重叠目标只处理一次', async () => {
    const selection = await seed();
    selection.targets = [...selection.targets, { kind: 'book', id: 'book-1' }];
    await applyBatch(db, selection, { kind: 'read', finished: true }, true);
    expect((await db.progress.toArray()).map((row) => row.page)).toEqual([
      11, 11, 11,
    ]);
    expect(await db.bookmarks.count()).toBe(1);
    await applyBatch(db, selection, { kind: 'read', finished: false }, true);
    expect(await db.progress.count()).toBe(0);
    expect(
      (await db.books.toArray()).every((book) => book.lastReadAt === null),
    ).toBe(true);
    expect(await db.bookmarks.count()).toBe(1);
  });

  it('选择部分卷移动时以系列为单位，其他属性和书目保留', async () => {
    await seed();
    const before = await db.books.toArray();
    const group = await createLibraryGroup(db, 'Favorites');
    await applyBatch(
      db,
      { targets: [{ kind: 'book', id: 'b2' }], bookIds: ['b2'] },
      { kind: 'move', groupId: group.id },
      true,
    );
    expect((await db.series.get('series-1'))?.groupId).toBe(group.id);
    expect((await db.series.get('s2'))?.groupId).toBeNull();
    expect(await db.books.toArray()).toEqual(before);
  });

  it('任意一本写入失败时整体回滚，不留下部分进度', async () => {
    const selection = await seed();
    const before = await db.books.toArray();
    db.progress.hook('creating', (_key, row) => {
      if (row.bookId === 'b3') throw new Error('disk full');
    });
    await expect(
      applyBatch(db, selection, { kind: 'read', finished: true }, true),
    ).rejects.toThrow('disk full');
    expect(await db.progress.count()).toBe(0);
    expect(await db.books.toArray()).toEqual(before);
  });

  it('目标分组不存在时不改变任何系列', async () => {
    const selection = await seed();
    const before = await db.series.toArray();
    await expect(
      applyBatch(db, selection, { kind: 'move', groupId: 'missing' }, true),
    ).rejects.toThrow('GROUP_NOT_FOUND');
    expect(await db.series.toArray()).toEqual(before);
  });

  it('删除原子生成清理任务，副本与原位分别交给安全清理，不删除分组', async () => {
    const selection = await seed();
    const group = await createLibraryGroup(db, 'Keep');
    await applyBatch(db, selection, { kind: 'delete' }, true);
    expect(await db.books.count()).toBe(0);
    expect(await db.series.count()).toBe(0);
    expect(await db.bookmarks.count()).toBe(0);
    expect(await db.fileCleanup.count()).toBe(3);
    expect(await db.libraryGroups.get(group.id)).toBeDefined();
    const disposeBook = vi.fn(async () => {
      expect(await db.books.count()).toBe(0);
    });
    await new FileCleanupQueue(db, { disposeBook }).drain();
    expect(disposeBook).toHaveBeenCalledWith({
      bookId: 'b2',
      deleteCopy: false,
    });
    expect(disposeBook).toHaveBeenCalledWith({
      bookId: 'book-1',
      deleteCopy: true,
    });
    expect(await db.fileCleanup.count()).toBe(0);
  });

  it('系列新增卷或所选书目被删后拒绝扩大/缩小删除范围', async () => {
    const selection = await seed();
    await db.books.add(
      testBook({
        id: 'new',
        seriesId: 'series-1',
        fingerprint: 'd'.repeat(64),
      }),
    );
    await expect(
      applyBatch(db, selection, { kind: 'delete' }, true),
    ).rejects.toThrow('SELECTION_CHANGED');
    expect(await db.books.count()).toBe(4);
    await db.books.delete('new');
    await db.books.delete('b3');
    await expect(
      applyBatch(db, selection, { kind: 'delete' }, true),
    ).rejects.toThrow('SELECTION_CHANGED');
    expect(await db.books.count()).toBe(2);
    expect(await db.fileCleanup.count()).toBe(0);
  });

  it('删除过程中发生错误时书目、书签与清理任务全部回滚', async () => {
    const selection = await seed();
    const books = await db.books.toArray();
    db.books.hook('deleting', (id) => {
      if (id === 'b3') throw new Error('delete failed');
    });
    await expect(
      applyBatch(db, selection, { kind: 'delete' }, true),
    ).rejects.toThrow('delete failed');
    expect(await db.books.toArray()).toEqual(books);
    expect(await db.bookmarks.count()).toBe(1);
    expect(await db.fileCleanup.count()).toBe(0);
  });

  it('免费/退款状态不能批量应用，空选择也不能产生操作', async () => {
    const selection = await seed();
    await expect(
      applyBatch(db, selection, { kind: 'delete' }, false),
    ).rejects.toThrow('PRO_REQUIRED');
    await expect(
      applyBatch(db, { targets: [], bookIds: [] }, { kind: 'delete' }, true),
    ).rejects.toThrow('SELECTION_CHANGED');
    expect(await db.books.count()).toBe(3);
    expect(await db.fileCleanup.count()).toBe(0);
  });
});
