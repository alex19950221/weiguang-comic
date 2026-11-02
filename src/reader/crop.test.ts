import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import type { RenderedPage } from '@/native/comicArchive';
import { PageLoader } from './PageLoader';
import { saveCropBorders } from './preferences';

const rendered: RenderedPage = {
  url: 'file:///0.png',
  width: 400,
  height: 600,
  sourceWidth: 800,
  sourceHeight: 1200,
  cached: false,
};

describe('自动裁白边', () => {
  it('只在开启时向原生请求裁边，关闭时请求参数与以前一致', async () => {
    const options: unknown[] = [];
    const pages = [{ entry: 7, name: '1.jpg' }];
    for (const crop of [true, false, undefined]) {
      const loader = new PageLoader(
        { bookId: 'book', path: '/copy.zip', crop },
        pages,
        async (value) => {
          options.push(value);
          return rendered;
        },
      );
      await loader.load(0, 2048, loader.move(0));
    }
    expect(options).toEqual([
      {
        bookId: 'book',
        path: '/copy.zip',
        entry: 7,
        maxPixel: 2048,
        crop: true,
      },
      { bookId: 'book', path: '/copy.zip', entry: 7, maxPixel: 2048 },
      { bookId: 'book', path: '/copy.zip', entry: 7, maxPixel: 2048 },
    ]);
  });

  describe('按书保存', () => {
    let db: ComicDatabase;
    beforeEach(async () => {
      db = createDatabase('crop-borders-test', {
        indexedDB: new IDBFactory(),
        IDBKeyRange,
      });
      await db.open();
      await db.books.add(testBook());
      await db.books.add(
        testBook({ id: 'book-2', fingerprint: 'b'.repeat(64) }),
      );
    });
    afterEach(async () => {
      db.close();
      await db.delete();
    });

    it('只改当前书，重开后保留；可再关闭；缺书时报错', async () => {
      await saveCropBorders(db, 'book-1', true);
      db.close();
      await db.open();
      expect((await db.books.get('book-1'))?.cropBorders).toBe(true);
      expect((await db.books.get('book-2'))?.cropBorders).toBe(false);
      await saveCropBorders(db, 'book-1', false);
      expect((await db.books.get('book-1'))?.cropBorders).toBe(false);
      await saveCropBorders(db, 'book-1', false);
      await expect(saveCropBorders(db, 'missing', true)).rejects.toThrow(
        'BOOK_MISSING',
      );
    });
  });
});
