import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import { PageLoader } from './PageLoader';
import {
  activeImageFilters,
  normalizeImageFilters,
  ORIGINAL_FILTERS,
  saveImageFilters,
} from './filters';

const adjusted = { contrast: 125, sharpness: 40, warmth: 60 };
describe('画面滤镜边界与权益', () => {
  it('旧书与非法数值默认原图，有效值限幅取整', () => {
    expect(normalizeImageFilters()).toEqual(ORIGINAL_FILTERS);
    expect(
      normalizeImageFilters({
        contrast: NaN,
        sharpness: Infinity,
        warmth: -Infinity,
      }),
    ).toEqual(ORIGINAL_FILTERS);
    expect(
      normalizeImageFilters({ contrast: 0, sharpness: 999, warmth: 24.6 }),
    ).toEqual({ contrast: 50, sharpness: 100, warmth: 25 });
  });
  it('退款立即显示原图，重新解锁恢复原选择而不改存储值', () => {
    const stored = { ...adjusted };
    expect(activeImageFilters(stored, false)).toEqual(ORIGINAL_FILTERS);
    expect(activeImageFilters(stored, true)).toEqual(adjusted);
    expect(stored).toEqual(adjusted);
  });
  it('原图不改变旧原生参数，滤镜与裁边可以同时请求', async () => {
    const requests: unknown[] = [];
    for (const filters of [undefined, ORIGINAL_FILTERS, adjusted]) {
      const loader = new PageLoader(
        { bookId: 'book', path: '/copy.zip', crop: true, filters },
        [{ entry: 3, name: 'page.png' }],
        async (options) => {
          requests.push(options);
          return {
            url: 'file:///preview.png',
            width: 100,
            height: 200,
            sourceWidth: 100,
            sourceHeight: 200,
            cached: false,
          };
        },
      );
      await loader.load(0, 2048, loader.move(0));
      loader.dispose();
    }
    const original = {
      bookId: 'book',
      path: '/copy.zip',
      crop: true,
      entry: 3,
      maxPixel: 2048,
    };
    expect(requests).toEqual([
      original,
      original,
      { ...original, filters: adjusted },
    ]);
  });
});
describe('每书滤镜安全持久化', () => {
  let db: ComicDatabase;
  beforeEach(async () => {
    db = createDatabase('filters-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await db.open();
    await db.books.bulkAdd([
      testBook(),
      testBook({ id: 'book-2', fingerprint: 'b'.repeat(64) }),
    ]);
    await db.progress.put({
      bookId: 'book-1',
      page: 3,
      offset: 0.4,
      updatedAt: 200,
    });
    await db.bookmarks.put({
      id: 'mark',
      bookId: 'book-1',
      page: 2,
      offset: 0,
      updatedAt: 100,
      createdAt: 100,
      note: '',
    });
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });
  it('只改当前书，重开保留，不改进度/书签/路径和其他设置', async () => {
    const before = await db.books.toArray();
    const progress = await db.progress.toArray();
    const bookmarks = await db.bookmarks.toArray();
    const settings = await db.settings.toArray();
    await saveImageFilters(db, 'book-1', adjusted, true);
    db.close();
    await db.open();
    expect(await db.books.get('book-1')).toEqual({
      ...before[0],
      imageFilters: adjusted,
    });
    expect(await db.books.get('book-2')).toEqual(before[1]);
    expect(await db.progress.toArray()).toEqual(progress);
    expect(await db.bookmarks.toArray()).toEqual(bookmarks);
    expect(await db.settings.toArray()).toEqual(settings);
  });
  it('免费不能应用非原图，但可还原已保存的 Pro 设置', async () => {
    await saveImageFilters(db, 'book-1', adjusted, true);
    await expect(
      saveImageFilters(db, 'book-1', { ...adjusted, warmth: 80 }, false),
    ).rejects.toThrow('PRO_REQUIRED');
    expect((await db.books.get('book-1'))?.imageFilters).toEqual(adjusted);
    await saveImageFilters(db, 'book-1', { ...ORIGINAL_FILTERS }, false);
    expect((await db.books.get('book-1'))?.imageFilters).toEqual(
      ORIGINAL_FILTERS,
    );
  });
  it('写入失败保留旧参数，缺书不复活', async () => {
    await saveImageFilters(db, 'book-1', adjusted, true);
    const before = await db.books.get('book-1');
    const fail = () => {
      throw new Error('DISK_FULL');
    };
    db.books.hook('updating', fail);
    await expect(
      saveImageFilters(db, 'book-1', { ...ORIGINAL_FILTERS }, false),
    ).rejects.toThrow('DISK_FULL');
    expect(await db.books.get('book-1')).toEqual(before);
    db.books.hook('updating').unsubscribe(fail);
    await db.books.delete('book-1');
    await expect(
      saveImageFilters(db, 'book-1', adjusted, true),
    ).rejects.toThrow('BOOK_MISSING');
    expect(await db.books.get('book-1')).toBeUndefined();
  });
});
