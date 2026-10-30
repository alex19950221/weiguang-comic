import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook, testSeries } from '@/db/testing/records';
import {
  createLibraryGroup,
  deleteLibraryGroup,
  moveSeriesToGroup,
  renameLibraryGroup,
} from './groups';

let db: ComicDatabase;
beforeEach(async () => {
  db = createDatabase('library-groups-test', {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe('M1-04 用户分组持久化', () => {
  it('名称去首尾及多余空白，全半角和大小写同名复用，顺序和名称重开后保留', async () => {
    const first = await createLibraryGroup(db, '  ＳＣＩ   ＦＩ  ');
    expect(first).toMatchObject({
      name: 'ＳＣＩ ＦＩ',
      nameKey: 'sci fi',
      order: 0,
    });
    expect(await createLibraryGroup(db, 'sci fi')).toEqual(first);
    const second = await createLibraryGroup(db, '待看');
    expect(second.order).toBe(1);
    db.close();
    await db.open();
    expect(await db.libraryGroups.orderBy('order').toArray()).toEqual([
      first,
      second,
    ]);
  });

  it('空名称或超过原型 20 字上限时不写库', async () => {
    await expect(createLibraryGroup(db, '   ')).rejects.toMatchObject({
      code: 'GROUP_NAME_REQUIRED',
    });
    await expect(createLibraryGroup(db, '字'.repeat(21))).rejects.toMatchObject(
      { code: 'GROUP_NAME_TOO_LONG' },
    );
    expect(await db.libraryGroups.count()).toBe(0);
  });

  it('并发创建同名分组只产生一个稳定 ID', async () => {
    const groups = await Promise.all([
      createLibraryGroup(db, '我的分组'),
      createLibraryGroup(db, ' 我的分组 '),
    ]);
    expect(groups[0]?.id).toBe(groups[1]?.id);
    expect(await db.libraryGroups.count()).toBe(1);
  });

  it('移动系列后所有卷共享归属，重开保留且不改书目、进度和收藏', async () => {
    const series = testSeries({ favoritedAt: 321 });
    const books = [
      testBook({ seriesId: series.id }),
      testBook({ id: 'book-2', seriesId: series.id, volume: 2 }),
    ];
    const progress = {
      bookId: books[0]!.id,
      page: 3,
      offset: 0.25,
      updatedAt: 200,
    };
    await db.series.add(series);
    await db.books.bulkAdd(books);
    await db.progress.add(progress);
    const group = await createLibraryGroup(db, '待看');
    await moveSeriesToGroup(db, series.id, group.id);
    db.close();
    await db.open();
    expect(await db.series.get(series.id)).toMatchObject({
      groupId: group.id,
      favoritedAt: 321,
    });
    expect(await db.books.toArray()).toEqual(books);
    expect(await db.progress.get(progress.bookId)).toEqual(progress);
    await moveSeriesToGroup(db, series.id, null);
    expect((await db.series.get(series.id))?.groupId).toBeNull();
  });

  it('不存在的分组或系列不能生成悬空关系', async () => {
    const group = await createLibraryGroup(db, '原分组');
    const series = testSeries({ groupId: group.id });
    await db.series.add(series);
    await expect(
      moveSeriesToGroup(db, series.id, 'missing'),
    ).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    await expect(
      moveSeriesToGroup(db, 'missing', group.id),
    ).rejects.toMatchObject({ code: 'SERIES_NOT_FOUND' });
    expect(await db.series.get(series.id)).toEqual(series);
  });

  it('改名保留 ID 和顺序，重名、无效及不存在的分组拒绝修改', async () => {
    const first = await createLibraryGroup(db, '第一组');
    const second = await createLibraryGroup(db, '第二组');
    await expect(
      renameLibraryGroup(db, first.id, '第二组'),
    ).rejects.toMatchObject({ code: 'GROUP_NAME_EXISTS' });
    await expect(renameLibraryGroup(db, first.id, '')).rejects.toMatchObject({
      code: 'GROUP_NAME_REQUIRED',
    });
    await expect(
      renameLibraryGroup(db, 'missing', '新名称'),
    ).rejects.toMatchObject({ code: 'GROUP_NOT_FOUND' });
    expect(await db.libraryGroups.get(first.id)).toEqual(first);
    await renameLibraryGroup(db, first.id, '新名称');
    db.close();
    await db.open();
    expect(await db.libraryGroups.get(first.id)).toMatchObject({
      id: first.id,
      name: '新名称',
      nameKey: '新名称',
      order: first.order,
      createdAt: first.createdAt,
    });
    expect(await db.libraryGroups.get(second.id)).toEqual(second);
  });

  it('删组仅移回未分组，保留书目、进度、书签、收藏和其他分组', async () => {
    const group = await createLibraryGroup(db, '要删除的分组');
    const other = await createLibraryGroup(db, '保留的分组');
    const series = testSeries({ groupId: group.id, favoritedAt: 321 });
    const book = testBook({ seriesId: series.id });
    const progress = { bookId: book.id, page: 3, offset: 0, updatedAt: 200 };
    const bookmark = {
      ...progress,
      id: 'bookmark',
      note: '保留',
      createdAt: 200,
    };
    await db.series.add(series);
    await db.books.add(book);
    await db.progress.add(progress);
    await db.bookmarks.add(bookmark);
    await deleteLibraryGroup(db, group.id);
    await deleteLibraryGroup(db, group.id);
    db.close();
    await db.open();
    expect(await db.libraryGroups.get(group.id)).toBeUndefined();
    expect(await db.libraryGroups.get(other.id)).toEqual(other);
    expect(await db.series.get(series.id)).toMatchObject({
      groupId: null,
      favoritedAt: 321,
    });
    expect(await db.books.get(book.id)).toEqual(book);
    expect(await db.progress.get(book.id)).toEqual(progress);
    expect(await db.bookmarks.get(bookmark.id)).toEqual(bookmark);
    expect(await db.fileCleanup.count()).toBe(0);
  });

  it('删组事务中途失败时，系列归属和分组删除一起回滚', async () => {
    const group = await createLibraryGroup(db, '保留');
    const series = testSeries({ groupId: group.id });
    await db.series.add(series);
    db.libraryGroups.hook('deleting', () => {
      throw new Error('模拟删除失败');
    });
    await expect(deleteLibraryGroup(db, group.id)).rejects.toThrow(
      '模拟删除失败',
    );
    expect(await db.libraryGroups.get(group.id)).toEqual(group);
    expect(await db.series.get(series.id)).toEqual(series);
  });

  it('移动和删组并发时不会留下已删除分组的关联', async () => {
    const group = await createLibraryGroup(db, '临时分组');
    const series = testSeries();
    await db.series.add(series);
    await Promise.all([
      moveSeriesToGroup(db, series.id, group.id),
      deleteLibraryGroup(db, group.id),
    ]);
    expect((await db.series.get(series.id))?.groupId).toBeNull();
    expect(await db.libraryGroups.get(group.id)).toBeUndefined();
  });
});
