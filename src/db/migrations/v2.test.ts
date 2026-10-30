import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, schemaV1, schemaV2 } from '../schema';
import type { Book, ImportJob, PendingMatch, Series } from '../models';
import { createLibraryGroup, moveSeriesToGroup } from '@/library/groups';
import { legacyBook, legacySeries } from '../testing/records';
import { upgradeToV2 } from './v2';

let factory: IDBFactory;
let instances: Dexie[];
const name = 'comic-upgrade-v2-test';
beforeEach(() => {
  factory = new IDBFactory();
  instances = [];
});
afterEach(async () => {
  for (const db of instances) db.close();
  if (instances[0]) await instances[0].delete();
});
async function v1() {
  const db = new Dexie(name, {
    indexedDB: factory,
    IDBKeyRange,
    autoOpen: false,
  });
  instances.push(db);
  db.version(1).stores(schemaV1);
  await db.open();
  return db;
}
async function v2() {
  const db = createDatabase(name, { indexedDB: factory, IDBKeyRange });
  instances.push(db);
  await db.open();
  return db;
}
function job(bookId: string, fileName: string, updatedAt = 200): ImportJob {
  return {
    id: `${bookId}-${updatedAt}`,
    bookId,
    source: {
      uri: 'expired-test-token',
      name: fileName,
      size: 123,
      isDirectory: false,
    },
    state: 'done',
    copiedBytes: 123,
    path: `/private/test/${bookId}.zip`,
    error: null,
    createdAt: 100,
    updatedAt,
  };
}

describe('M1-04 Dexie v1 → v2', () => {
  it('升级保留原书名、路径、进度、书签、设置、恢复记录和页目录', async () => {
    const old = await v1();
    const book = legacyBook({
      title: '用户保留的书名',
      direction: 'rtl',
      lastReadAt: 300,
      meta: { writer: '保留的元数据' },
    });
    const pages = {
      bookId: book.id,
      pages: [{ entry: 5, name: '01.jpg' }],
      updatedAt: 100,
    };
    const progress = { bookId: book.id, page: 4, offset: 0.4, updatedAt: 300 };
    const mark = {
      ...progress,
      id: 'bookmark',
      note: '保留笔记',
      createdAt: 300,
    };
    const { id, path, location, status, ...backupBook } = book;
    void id;
    void path;
    void location;
    void status;
    const pending: PendingMatch = {
      fingerprint: 'b'.repeat(64),
      book: backupBook,
      progress: null,
      bookmarks: [],
      updatedAt: 400,
    };
    await old.table('books').add(book);
    await old.table('pageLists').add(pages);
    await old.table('progress').add(progress);
    await old.table('bookmarks').add(mark);
    await old.table('settings').put({
      key: 'reader.defaults',
      value: { direction: 'rtl', mode: 'scroll', background: 'black' },
    });
    await old.table('pendingMatches').add(pending);
    const imported = job(book.id, '[标注] 测试系列 第02卷.cbz');
    await old.table('imports').add(imported);
    old.close();
    const db = await v2();
    const migrated = await db.books.get(book.id);
    expect(migrated).toMatchObject({
      ...book,
      fileName: imported.source.name,
      unit: '卷',
      volume: 2,
      seriesId: expect.any(String),
    });
    expect((await db.series.get(migrated!.seriesId!))?.title).toBe('测试系列');
    expect(await db.pageLists.get(book.id)).toEqual(pages);
    expect(await db.progress.get(book.id)).toEqual(progress);
    expect(await db.bookmarks.get(mark.id)).toEqual(mark);
    expect((await db.settings.get('reader.defaults'))?.value).toEqual({
      direction: 'rtl',
      mode: 'scroll',
      background: 'black',
    });
    expect(await db.imports.get(imported.id)).toEqual(imported);
    expect(await db.pendingMatches.get(pending.fingerprint)).toEqual(pending);
    expect(await db.libraryGroups.count()).toBe(0);
    expect(await db.fileCleanup.count()).toBe(0);
    expect(db.verno).toBe(2);
  });

  it('没有原文件名来源时保留 null，用旧标题识别卷和话，不从 UUID 路径猜测', async () => {
    const old = await v1();
    await old
      .table('books')
      .bulkAdd([
        legacyBook(),
        legacyBook({ id: 'book-2', title: '测试系列 第02卷' }),
        legacyBook({ id: 'book-3', title: '另一系列 第7话' }),
      ]);
    old.close();
    const db = await v2();
    const first = await db.books.get('book-1');
    const second = await db.books.get('book-2');
    expect(first).toMatchObject({
      fileName: null,
      volume: 1,
      chapter: null,
      unit: '卷',
    });
    expect(second?.seriesId).toBe(first?.seriesId);
    expect(await db.books.get('book-3')).toMatchObject({
      fileName: null,
      volume: null,
      chapter: 7,
      unit: '话',
    });
    expect(await db.series.count()).toBe(2);
  });

  it('只从最新已完成作业回填文件名，失败和重复作业不能替换来源', async () => {
    const old = await v1();
    await old.table('books').add(legacyBook());
    await old
      .table('imports')
      .bulkAdd([
        job('book-1', '旧来源 第01卷.zip', 100),
        job('book-1', '新来源 第03卷.zip', 200),
        { ...job('book-1', '失败文件.zip', 300), state: 'failed' },
        { ...job('book-1', '重复文件.zip', 400), state: 'duplicate' },
      ]);
    old.close();
    const db = await v2();
    expect(await db.books.get('book-1')).toMatchObject({
      fileName: '新来源 第03卷.zip',
      volume: 3,
    });
  });

  it('同键旧系列确定性合并，保留最早 ID、隐藏标记并重定向书籍关系', async () => {
    const old = await v1();
    await old.table('series').bulkAdd([
      legacySeries({ id: 'older', title: '测试 系列', createdAt: 20 }),
      legacySeries({
        id: 'newer',
        title: '测试-系列',
        createdAt: 30,
        updatedAt: 250,
        hidden: true,
      }),
    ]);
    await old
      .table('books')
      .bulkAdd([
        legacyBook({ seriesId: 'older' }),
        legacyBook({ id: 'book-2', seriesId: 'newer', volume: 9 }),
      ]);
    old.close();
    const db = await v2();
    expect(await db.series.toArray()).toEqual([
      expect.objectContaining({
        id: 'older',
        key: '测试系列',
        title: '测试 系列',
        hidden: true,
        createdAt: 20,
        updatedAt: 250,
      }),
    ]);
    expect(
      (await db.books.toArray()).every((book) => book.seriesId === 'older'),
    ).toBe(true);
    expect((await db.books.get('book-2'))?.volume).toBe(9);
  });

  it('已有人工系列关联和卷话号不被文件名覆盖，空系列也不丢失', async () => {
    const old = await v1();
    await old
      .table('series')
      .bulkAdd([
        legacySeries({ title: '自定义系列' }),
        legacySeries({ id: 'empty', title: '保留的空系列' }),
      ]);
    await old
      .table('books')
      .add(legacyBook({ seriesId: 'series-1', chapter: 25 }));
    await old.table('imports').add(job('book-1', '其他名称 第03卷.cbz'));
    old.close();
    const db = await v2();
    expect(await db.books.get('book-1')).toMatchObject({
      seriesId: 'series-1',
      chapter: 25,
      volume: null,
      unit: '话',
    });
    expect((await db.series.get('series-1'))?.title).toBe('自定义系列');
    expect(await db.series.get('empty')).toBeDefined();
  });

  it('空比较键彼此隔离，生成的系列 ID 避开已有 ID', async () => {
    const old = await v1();
    await old
      .table('series')
      .add(legacySeries({ id: 'series:book-1', title: '已有系列' }));
    await old
      .table('books')
      .bulkAdd([
        legacyBook({ title: '!!!' }),
        legacyBook({ id: 'book-2', title: '???' }),
      ]);
    old.close();
    const db = await v2();
    const first = await db.books.get('book-1');
    const second = await db.books.get('book-2');
    expect(first?.seriesId).not.toBe(second?.seriesId);
    expect(first?.seriesId).not.toBe('series:book-1');
    expect(await db.series.count()).toBe(3);
  });

  it('升级中途失败时回滚版本、索引和全部写入，原 v1 可重新打开', async () => {
    const old = await v1();
    const book = legacyBook();
    await old.table('books').add(book);
    old.close();
    const failing = new Dexie(name, {
      indexedDB: factory,
      IDBKeyRange,
      autoOpen: false,
    });
    instances.push(failing);
    failing.version(1).stores(schemaV1);
    failing
      .version(2)
      .stores(schemaV2)
      .upgrade(async (transaction) => {
        await upgradeToV2(transaction);
        throw new Error('模拟升级失败');
      });
    await expect(failing.open()).rejects.toThrow('模拟升级失败');
    failing.close();
    const reopened = await v1();
    expect(reopened.verno).toBe(1);
    expect(await reopened.table('books').get(book.id)).toEqual(book);
    expect(await reopened.table('series').count()).toBe(0);
    expect(reopened.tables.map((table) => table.name).sort()).toEqual(
      Object.keys(schemaV1).sort(),
    );
  });

  it('重开 v2 不重跑回填，不覆盖分组、收藏和稳定系列 ID', async () => {
    const old = await v1();
    await old.table('books').add(legacyBook());
    old.close();
    const first = await v2();
    const book = (await first.books.get('book-1'))!;
    const group = await createLibraryGroup(first, '保留分组');
    await moveSeriesToGroup(first, book.seriesId!, group.id);
    await first.series.update(book.seriesId!, { favoritedAt: 500 });
    const saved = await first.series.get(book.seriesId!);
    first.close();
    const reopened = await v2();
    expect(await reopened.books.get(book.id)).toEqual(book);
    expect(await reopened.series.get(book.seriesId!)).toEqual(saved);
    expect(await reopened.libraryGroups.get(group.id)).toEqual(group);
  });

  it('升级完成后书籍和系列均具有 v2 必需字段', async () => {
    const old = await v1();
    await old.table('books').add(legacyBook());
    old.close();
    const db = await v2();
    const book: Book = (await db.books.toArray())[0]!;
    const series: Series = (await db.series.toArray())[0]!;
    expect(book.fileName).toBeNull();
    expect(book.unit).toBe('卷');
    expect(series).toMatchObject({
      key: '测试系列',
      groupId: null,
      favoritedAt: null,
    });
  });
});
