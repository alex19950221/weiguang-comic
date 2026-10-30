import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Book } from './models';
import { createDatabase, schemaV2 } from './schema';

let factory: IDBFactory;
let instances: Dexie[];
beforeEach(() => {
  factory = new IDBFactory();
  instances = [];
});
afterEach(async () => {
  instances.forEach((database) => database.close());
  const names = new Set<string>();
  for (const database of instances) {
    if (names.has(database.name)) continue;
    names.add(database.name);
    await database.delete();
  }
});

function database() {
  const result = createDatabase('comic-schema-test', {
    indexedDB: factory,
    IDBKeyRange,
  });
  instances.push(result);
  return result;
}

const sample: Book = {
  id: 'sample',
  fingerprint: 'a'.repeat(64),
  title: '自己的测试文件',
  fileName: '自己的测试文件.zip',
  unit: '卷',
  seriesId: null,
  volume: null,
  chapter: null,
  sortKey: 'sample',
  format: 'zip',
  location: 'copy',
  path: '/private/test/sample.zip',
  sizeBytes: 123,
  pageCount: 2,
  coverPage: 0,
  nameEncoding: 'utf-8',
  direction: null,
  mode: null,
  spreadOffset: 0,
  cropBorders: false,
  status: 'ready',
  importedAt: 100,
  lastReadAt: null,
  meta: null,
};

describe('M1-01 本地数据库', () => {
  it('首次建库直接使用 v2 十张表与默认设置，构造实例时不自动打开', async () => {
    const db = database();
    expect(db.isOpen()).toBe(false);
    await db.open();
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      Object.keys(schemaV2).sort(),
    );
    expect(await db.settings.get('reader.defaults')).toEqual({
      key: 'reader.defaults',
      value: { direction: 'ltr', mode: 'paged', background: 'system' },
    });
    expect(await db.books.count()).toBe(0);
  });

  it('重开数据库保留书籍、页目录、进度与用户设置，不重新覆盖默认值', async () => {
    const first = database();
    await first.open();
    await first.books.add(sample);
    await first.pageLists.put({
      bookId: sample.id,
      pages: [
        { entry: 9, name: '01.jpg' },
        { entry: 4, name: '02.jpg' },
      ],
      updatedAt: 200,
    });
    await first.progress.put({
      bookId: sample.id,
      page: 1,
      offset: 0.35,
      updatedAt: 200,
    });
    await first.settings.put({
      key: 'reader.defaults',
      value: { direction: 'rtl', mode: 'scroll', background: 'black' },
    });
    first.close();
    const reopened = database();
    await reopened.open();
    expect(await reopened.books.get(sample.id)).toEqual(sample);
    expect((await reopened.pageLists.get(sample.id))?.pages[1]?.entry).toBe(4);
    expect((await reopened.progress.get(sample.id))?.offset).toBe(0.35);
    expect((await reopened.settings.get('reader.defaults'))?.value).toEqual({
      direction: 'rtl',
      mode: 'scroll',
      background: 'black',
    });
  });

  it('遇到未来版本拒绝打开，保留原数据库而不是删除重建', async () => {
    const future = new Dexie('comic-schema-test', {
      indexedDB: factory,
      IDBKeyRange,
      autoOpen: false,
    });
    instances.push(future);
    future.version(3).stores(schemaV2);
    await future.open();
    await future.table<Book>('books').add(sample);
    future.close();
    const older = database();
    await expect(older.open()).rejects.toMatchObject({ name: 'VersionError' });
    await future.open();
    expect(await future.table<Book>('books').get(sample.id)).toEqual(sample);
  });
});
