import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabase } from '@/db/schema';
import type { ComicDatabase } from '@/db/schema';
import type { ImportJob, ImportSource } from '@/db/models';
import type { ComicArchivePlugin, Inspection } from '@/native/comicArchive';
import type { ComicImportPlugin, ImportProgress } from '@/native/comicImport';
import { ImportQueue } from './ImportQueue';
import { createLibraryGroup, moveSeriesToGroup } from './groups';
import { testSeries } from '@/db/testing/records';

let db: ComicDatabase;
beforeEach(async () => {
  db = createDatabase('import-queue-test', {
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  await db.open();
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const source = (name = '自己的测试文件.cbz'): ImportSource => ({
  uri: crypto.randomUUID(),
  name,
  size: 0,
  isDirectory: false,
});
const inspection: Inspection = {
  format: 'zip',
  encrypted: false,
  entries: [
    { index: 0, name: '10.jpg', size: 10 },
    { index: 1, name: '2.jpg', size: 10 },
    { index: 2, name: '../unsafe.jpg', size: 10 },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function fixture() {
  let progress: (event: ImportProgress) => void = () => undefined;
  const copy = vi.fn<ComicImportPlugin['copyToLibrary']>(
    async ({ bookId }) => ({ path: `/library/${bookId}.zip`, size: 123 }),
  );
  const removeCopy = vi.fn<ComicImportPlugin['removeCopy']>(
    async () => undefined,
  );
  const files: ComicImportPlugin = {
    pickFiles: async () => ({ items: [] }),
    copyToLibrary: copy,
    cancel: vi.fn(async () => undefined),
    removeCopy,
    releaseSources: vi.fn(async () => undefined),
    addListener: async (_event, listener) => {
      progress = listener;
      return {
        remove: async () => {
          progress = () => undefined;
        },
      };
    },
  };
  const inspect = vi.fn<ComicArchivePlugin['inspect']>(async () => inspection);
  const clearCache = vi.fn<ComicArchivePlugin['clearCache']>(
    async () => undefined,
  );
  const archive: ComicArchivePlugin = {
    inspect,
    fingerprint: vi.fn(async () => ({ sha256: 'a'.repeat(64), size: 123 })),
    clearCache,
    renderPage: vi.fn(),
    thumbnail: vi.fn(),
    disposeBook: vi.fn(),
  };
  const onProgress = vi.fn();
  const onError = vi.fn();
  const queue = new ImportQueue(db, archive, files, onProgress, onError);
  return {
    queue,
    files,
    archive,
    copy,
    inspect,
    clearCache,
    removeCopy,
    onProgress,
    onError,
    emit: (event: ImportProgress) => progress(event),
  };
}

describe('M1-03 ZIP/CBZ 导入作业', () => {
  it('原子保存书籍、过滤并自然排序后的页目录，重开后保留完成记录', async () => {
    const { queue, removeCopy } = fixture();
    await queue.enqueue([source()]);
    await queue.idle();
    const book = (await db.books.toArray())[0]!;
    expect(book).toMatchObject({
      title: '自己的测试文件',
      fileName: '自己的测试文件.cbz',
      unit: '卷',
      pageCount: 2,
      sizeBytes: 123,
      location: 'copy',
    });
    expect(await db.series.get(book.seriesId!)).toMatchObject({
      title: book.title,
      key: '自己的测试文件',
      groupId: null,
    });
    expect(
      (await db.pageLists.get(book.id))?.pages.map((page) => page.entry),
    ).toEqual([1, 0]);
    db.close();
    await db.open();
    expect((await db.imports.toArray())[0]?.state).toBe('done');
    expect(removeCopy).not.toHaveBeenCalled();
  });

  it('ComicInfo 标记右翻的书默认 RTL，未标记的仍为全局默认', async () => {
    const { queue, inspect, archive } = fixture();
    inspect.mockResolvedValueOnce({ ...inspection, manga: 'rtl' });
    vi.mocked(archive.fingerprint)
      .mockResolvedValueOnce({ sha256: 'b'.repeat(64), size: 123 })
      .mockResolvedValueOnce({ sha256: 'c'.repeat(64), size: 123 });
    await queue.enqueue([source('漫画第一卷.cbz'), source('普通第一卷.cbz')]);
    await queue.idle();
    const books = await db.books.toArray();
    expect(books.find((b) => b.fileName === '漫画第一卷.cbz')?.direction).toBe(
      'rtl',
    );
    expect(books.find((b) => b.fileName === '普通第一卷.cbz')?.direction).toBe(
      null,
    );
  });

  it('重复指纹只保留一本书，清理新副本，不删除已有文件', async () => {
    const { queue, removeCopy } = fixture();
    await queue.enqueue([source('第一份.zip'), source('重命名副本.cbz')]);
    await queue.idle();
    const books = await db.books.toArray();
    const jobs = await db.imports.toArray();
    expect(books).toHaveLength(1);
    expect(await db.series.count()).toBe(1);
    const duplicate = jobs.find((job) => job.state === 'duplicate')!;
    expect(duplicate).toMatchObject({ path: null, cleanupPending: false });
    expect(removeCopy).toHaveBeenCalledExactlyOnceWith({
      bookId: duplicate.bookId,
    });
    expect(duplicate.bookId).not.toBe(books[0]!.id);
  });

  it('加密包失败后不入库，清理应用副本，后续文件仍可继续导入', async () => {
    const { queue, inspect, removeCopy } = fixture();
    inspect.mockResolvedValueOnce({ ...inspection, encrypted: true });
    await queue.enqueue([source('加密.zip'), source('正常.zip')]);
    await queue.idle();
    expect(await db.books.count()).toBe(1);
    expect(await db.imports.where('state').equals('failed').count()).toBe(1);
    expect(removeCopy).toHaveBeenCalledTimes(1);
  });

  it('PDF 按原生页序入库，格式记为 pdf，书名去掉扩展名', async () => {
    const { queue, copy, inspect } = fixture();
    copy.mockImplementationOnce(async ({ bookId }) => ({
      path: `/library/${bookId}.pdf`,
      size: 123,
    }));
    inspect.mockResolvedValueOnce({
      format: 'pdf',
      encrypted: false,
      entries: [
        { index: 1, name: '0002', size: 1 },
        { index: 0, name: '0001', size: 1 },
      ],
    });
    await queue.enqueue([source('测试系列 第03卷.pdf')]);
    await queue.idle();
    const book = (await db.books.toArray())[0]!;
    expect(book).toMatchObject({
      title: '测试系列',
      volume: 3,
      format: 'pdf',
      pageCount: 2,
      nameEncoding: 'utf-8',
    });
    expect(book.path).toMatch(/\.pdf$/);
    expect(
      (await db.pageLists.get(book.id))?.pages.map((page) => page.entry),
    ).toEqual([0, 1]);
  });

  it('需要密码或没有页面的 PDF 不入库并清理副本', async () => {
    const { queue, inspect, removeCopy } = fixture();
    inspect
      .mockResolvedValueOnce({ format: 'pdf', encrypted: true, entries: [] })
      .mockResolvedValueOnce({ format: 'pdf', encrypted: false, entries: [] });
    await queue.enqueue([source('加密.pdf'), source('空白.pdf')]);
    await queue.idle();
    expect(await db.books.count()).toBe(0);
    const errors = (await db.imports.toArray()).map((job) => job.error);
    expect(errors).toEqual(
      expect.arrayContaining([
        '暂不支持需要密码的 PDF，请选择未加密的自有文件。',
        'PDF 中没有可读取的页面。',
      ]),
    );
    expect(removeCopy).toHaveBeenCalledTimes(2);
  });

  it('数据库事务失败时回滚书籍和页目录，再清理副本', async () => {
    const { queue, removeCopy } = fixture();
    db.pageLists.hook('creating', () => {
      throw new Error('模拟存储空间不足');
    });
    await queue.enqueue([source()]);
    await queue.idle();
    expect(await db.books.count()).toBe(0);
    expect(await db.pageLists.count()).toBe(0);
    expect(await db.series.count()).toBe(0);
    expect((await db.imports.toArray())[0]?.state).toBe('failed');
    expect(removeCopy).toHaveBeenCalledTimes(1);
  });

  it('多卷按解析结果写入同一系列，后续导入保留分组和收藏', async () => {
    const f = fixture();
    vi.mocked(f.archive.fingerprint)
      .mockResolvedValueOnce({ sha256: 'a'.repeat(64), size: 123 })
      .mockResolvedValueOnce({ sha256: 'b'.repeat(64), size: 123 });
    await f.queue.enqueue([source('[标注] 测试系列 Vol.01.cbz')]);
    await f.queue.idle();
    const first = (await db.books.toArray())[0]!;
    const group = await createLibraryGroup(db, '待看');
    await moveSeriesToGroup(db, first.seriesId!, group.id);
    await db.series.update(first.seriesId!, { favoritedAt: 500 });
    await f.queue.enqueue([source('测试系列 第02卷.zip')]);
    await f.queue.idle();
    const books = (await db.books.toArray()).sort(
      (a, b) => a.volume! - b.volume!,
    );
    expect(books).toHaveLength(2);
    expect(
      books.map((book) => [
        book.title,
        book.volume,
        book.chapter,
        book.unit,
        book.seriesId,
      ]),
    ).toEqual([
      ['测试系列', 1, null, '卷', first.seriesId],
      ['测试系列', 2, null, '卷', first.seriesId],
    ]);
    expect(books.map((book) => book.fileName)).toEqual([
      '[标注] 测试系列 Vol.01.cbz',
      '测试系列 第02卷.zip',
    ]);
    expect(await db.series.count()).toBe(1);
    expect(await db.series.get(first.seriesId!)).toMatchObject({
      groupId: group.id,
      favoritedAt: 500,
    });
    expect(await db.imports.where('state').equals('done').count()).toBe(2);
  });

  it('话号写入 chapter，不误写到 volume', async () => {
    const f = fixture();
    await f.queue.enqueue([source('测试系列 第7话.cbz')]);
    await f.queue.idle();
    expect((await db.books.toArray())[0]).toMatchObject({
      title: '测试系列',
      fileName: '测试系列 第7话.cbz',
      chapter: 7,
      volume: null,
      unit: '话',
    });
  });

  it('两个队列并发导入同系列不同卷，只建一条系列记录', async () => {
    const first = fixture();
    const second = fixture();
    vi.mocked(second.archive.fingerprint).mockResolvedValue({
      sha256: 'b'.repeat(64),
      size: 123,
    });
    await Promise.all([
      first.queue.enqueue([source('测试系列 第01卷.zip')]),
      second.queue.enqueue([source('测试系列 第02卷.cbz')]),
    ]);
    await Promise.all([first.queue.idle(), second.queue.idle()]);
    expect(await db.series.count()).toBe(1);
    const books = await db.books.toArray();
    expect(books).toHaveLength(2);
    expect(books[0]?.seriesId).toBe(books[1]?.seriesId);
    expect(await db.imports.where('state').equals('done').count()).toBe(2);
  });

  it('已有系列的更新时间也随导入事务失败回滚', async () => {
    const f = fixture();
    const series = testSeries({ updatedAt: 50, favoritedAt: 25 });
    await db.series.add(series);
    db.pageLists.hook('creating', () => {
      throw new Error('模拟目录保存失败');
    });
    await f.queue.enqueue([source('测试系列 第02卷.zip')]);
    await f.queue.idle();
    expect(await db.series.get(series.id)).toEqual(series);
    expect(await db.books.count()).toBe(0);
    expect((await db.imports.toArray())[0]?.state).toBe('failed');
  });

  it('复制中取消后丢弃迟到结果，同时取消排队文件而不读取它', async () => {
    const f = fixture();
    const started = deferred<void>();
    const copying = deferred<{ path: string; size: number }>();
    f.copy.mockImplementationOnce(async () => {
      started.resolve();
      return copying.promise;
    });
    await f.queue.enqueue([source('当前.zip'), source('排队.zip')]);
    await started.promise;
    const jobs = await db.imports.toArray();
    const active = jobs.find((job) => job.source.name === '当前.zip')!;
    const waiting = jobs.find((job) => job.source.name === '排队.zip')!;
    await f.queue.cancel(active.id);
    await f.queue.cancel(waiting.id);
    f.emit({ jobId: active.id, copied: 100, total: 123 });
    copying.resolve({ path: `/library/${active.bookId}.zip`, size: 123 });
    await f.queue.idle();
    expect(f.copy).toHaveBeenCalledTimes(1);
    expect(f.onProgress).not.toHaveBeenCalled();
    expect(await db.books.count()).toBe(0);
    expect(await db.imports.where('state').equals('cancelled').count()).toBe(2);
    expect(f.removeCopy).toHaveBeenCalledExactlyOnceWith({
      bookId: active.bookId,
    });
  });

  it('检查目录期间取消不会保存书籍', async () => {
    const f = fixture();
    const started = deferred<void>();
    const checking = deferred<Inspection>();
    f.inspect.mockImplementationOnce(async () => {
      started.resolve();
      return checking.promise;
    });
    await f.queue.enqueue([source()]);
    await started.promise;
    const job = (await db.imports.toArray())[0]!;
    await f.queue.cancel(job.id);
    checking.resolve(inspection);
    await f.queue.idle();
    expect(await db.books.count()).toBe(0);
    expect((await db.imports.get(job.id))?.state).toBe('cancelled');
  });

  it('重开清理中断副本，清理失败保留待清理标记，下次恢复可重试', async () => {
    const f = fixture();
    const job: ImportJob = {
      id: crypto.randomUUID(),
      bookId: crypto.randomUUID(),
      source: source(),
      state: 'copying',
      copiedBytes: 20,
      path: null,
      error: null,
      createdAt: 1,
      updatedAt: 1,
    };
    await db.imports.add(job);
    f.removeCopy.mockRejectedValueOnce(new Error('模拟清理失败'));
    await f.queue.recover();
    expect(await db.imports.get(job.id)).toMatchObject({
      state: 'failed',
      cleanupPending: true,
    });
    await f.queue.recover();
    expect(await db.imports.get(job.id)).toMatchObject({
      state: 'failed',
      cleanupPending: false,
      path: null,
    });
  });

  it('迟到或无效的进度事件不会串到其他文件，也不会让百分比倒退', async () => {
    const f = fixture();
    const started = deferred<void>();
    const copying = deferred<{ path: string; size: number }>();
    f.copy.mockImplementationOnce(async () => {
      started.resolve();
      return copying.promise;
    });
    await f.queue.enqueue([source()]);
    await started.promise;
    const job = (await db.imports.toArray())[0]!;
    f.emit({ jobId: 'other', copied: 10, total: 123 });
    f.emit({ jobId: job.id, copied: 10, total: 0 });
    f.emit({ jobId: job.id, copied: 100, total: 123 });
    f.emit({ jobId: job.id, copied: 50, total: 123 });
    expect(f.onProgress).toHaveBeenCalledTimes(1);
    copying.resolve({ path: `/library/${job.bookId}.zip`, size: 123 });
    await f.queue.idle();
  });
});
