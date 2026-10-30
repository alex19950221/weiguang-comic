import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type ComicDatabase } from '@/db/schema';
import { testBook } from '@/db/testing/records';
import { saveReaderPreferences } from './preferences';
import { saveReadingProgress, openReading, ProgressWriter } from './progress';

describe('第二轮阅读设置与页内进度持久化', () => {
  let db: ComicDatabase;
  beforeEach(async () => {
    db = createDatabase('reader-round2-test', {
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    await db.open();
    await db.books.add(testBook({ pageCount: 10 }));
    await db.pageLists.put({
      bookId: 'book-1',
      pages: Array.from({ length: 10 }, (_, index) => ({
        entry: index + 10,
        name: `${index}.jpg`,
      })),
      updatedAt: 1,
    });
  });
  afterEach(async () => {
    db.close();
    await db.delete();
  });
  it('适应宽度与亮度兼容旧设置，重开后保留且不覆盖方向', async () => {
    await saveReaderPreferences(db, 'book-1', { fit: 'width', brightness: 5 });
    db.close();
    await db.open();
    expect((await openReading(db, 'book-1')).defaults).toMatchObject({
      fit: 'width',
      brightness: 30,
      direction: 'ltr',
      mode: 'paged',
    });
    await saveReaderPreferences(db, 'book-1', { brightness: NaN });
    expect((await openReading(db, 'book-1')).defaults.brightness).toBe(100);
  });
  it('旧设置保持可读，新双页模式和封面选择重开后保留', async () => {
    expect(
      (await openReading(db, 'book-1')).defaults.spreadCover,
    ).toBeUndefined();
    await saveReaderPreferences(db, 'book-1', {
      mode: 'spread',
      spreadCover: 'paired',
    });
    db.close();
    await db.open();
    const session = await openReading(db, 'book-1');
    expect(session.defaults).toMatchObject({
      mode: 'spread',
      spreadCover: 'paired',
      background: 'system',
      direction: 'ltr',
    });
    expect(session.book).toMatchObject({ mode: 'spread', spreadOffset: 1 });
  });
  it('只改背景不覆盖方向、模式和当前书的其他元数据', async () => {
    await saveReaderPreferences(db, 'book-1', {
      mode: 'scroll',
      direction: 'rtl',
    });
    const before = await db.books.get('book-1');
    await saveReaderPreferences(db, 'book-1', { background: 'black' });
    expect(await db.books.get('book-1')).toEqual(before);
    expect((await openReading(db, 'book-1')).defaults).toMatchObject({
      direction: 'rtl',
      mode: 'scroll',
      background: 'black',
    });
  });
  it('书目更新失败时默认值也一起回滚', async () => {
    const before = await db.settings.get('reader.defaults');
    db.books.hook('updating', () => {
      throw new Error('故障');
    });
    await expect(
      saveReaderPreferences(db, 'book-1', { mode: 'spread' }),
    ).rejects.toThrow('故障');
    expect(await db.settings.get('reader.defaults')).toEqual(before);
    expect((await db.books.get('book-1'))?.mode).toBeNull();
  });
  it('已删除书不会因保存设置复活或改写默认值', async () => {
    await db.books.delete('book-1');
    const before = await db.settings.get('reader.defaults');
    await expect(
      saveReaderPreferences(db, 'book-1', { direction: 'rtl' }),
    ).rejects.toThrow('BOOK_MISSING');
    expect(await db.settings.get('reader.defaults')).toEqual(before);
  });
  it('条漫页内位置保存、重开与倒退，最后两页锚点不串用旧页内位置', async () => {
    await saveReadingProgress(db, 'book-1', 3, 100, 0.65);
    db.close();
    await db.open();
    expect(await openReading(db, 'book-1')).toMatchObject({
      page: 3,
      offset: 0.65,
    });
    await saveReadingProgress(db, 'book-1', 2, 101, 0.2);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 2,
      offset: 0.2,
    });
    await saveReadingProgress(db, 'book-1', 8, 102, 0.7);
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 9,
      offset: 0,
    });
  });
  it('无效页内位置归一化，越界旧页不携带旧偏移', async () => {
    await saveReadingProgress(db, 'book-1', 2, 100, NaN);
    expect((await db.progress.get('book-1'))?.offset).toBe(0);
    await saveReadingProgress(db, 'book-1', 2, 101, 2);
    expect((await db.progress.get('book-1'))?.offset).toBe(1);
    await db.progress.put({
      bookId: 'book-1',
      page: 100,
      offset: 0.8,
      updatedAt: 102,
    });
    expect(await openReading(db, 'book-1')).toMatchObject({
      page: 9,
      offset: 0,
    });
  });
  it('写队列重试保留最新页内位置，旧写入不能覆盖较新的倒退位置', async () => {
    const writer = new ProgressWriter(db, 'book-1');
    const first = writer.record(3, 0.8);
    const last = writer.record(1, 0.4);
    await Promise.all([first, last]);
    await writer.retry();
    await writer.flush();
    expect(await db.progress.get('book-1')).toMatchObject({
      page: 1,
      offset: 0.4,
    });
  });
});
