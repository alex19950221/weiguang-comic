import type { ComicDatabase } from '@/db/schema';
import type { Book, ReaderDefaults } from '@/db/models';
import type { ComicPage } from '@/archive/pageList';

const pageCount = (count: number) =>
  Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
export const clampOffset = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const clampPage = (page: number, count: number): number => {
  const total = pageCount(count);
  return Number.isFinite(page) && total > 0
    ? Math.max(0, Math.min(total - 1, Math.floor(page)))
    : 0;
};
/** 最后两页统一记末页；只由实际显示页面的回调调用，不由预读触发。 */
export function progressAnchor(page: number, count: number): number {
  const total = pageCount(count);
  const clamped = clampPage(page, total);
  return total > 0 && clamped >= total - 2 ? total - 1 : clamped;
}
export type ReadingErrorCode =
  'BOOK_MISSING' | 'BOOK_UNAVAILABLE' | 'PAGE_LIST_UNAVAILABLE';
export class ReadingError extends Error {
  constructor(readonly code: ReadingErrorCode) {
    super(code);
    this.name = 'ReadingError';
  }
}
export interface ReadingSession {
  book: Book;
  pages: ComicPage[];
  page: number;
  offset: number;
  defaults: ReaderDefaults;
  guideSeen: boolean;
}
export async function openReading(
  db: ComicDatabase,
  bookId: string,
): Promise<ReadingSession> {
  return db.transaction(
    'r',
    [db.books, db.pageLists, db.progress, db.settings],
    async () => {
      const book = await db.books.get(bookId);
      if (!book) throw new ReadingError('BOOK_MISSING');
      if (book.status !== 'ready') throw new ReadingError('BOOK_UNAVAILABLE');
      const pages = (await db.pageLists.get(bookId))?.pages;
      if (!pages?.length || pages.length !== book.pageCount)
        throw new ReadingError('PAGE_LIST_UNAVAILABLE');
      const progress = await db.progress.get(bookId);
      const setting = await db.settings.get('reader.defaults');
      const defaults: ReaderDefaults =
        setting?.key === 'reader.defaults'
          ? setting.value
          : { direction: 'ltr', mode: 'paged', background: 'system' };
      return {
        book,
        pages,
        page: clampPage(progress?.page ?? 0, pages.length),
        offset:
          progress && progress.page === clampPage(progress.page, pages.length)
            ? clampOffset(progress.offset)
            : 0,
        defaults,
        guideSeen:
          (await db.settings.get('reader.tap-hint-seen'))?.value === true,
      };
    },
  );
}
export async function saveReadingProgress(
  db: ComicDatabase,
  bookId: string,
  page: number,
  now = Date.now(),
  offset = 0,
): Promise<void> {
  await db.transaction('rw', [db.books, db.progress, db.settings], async () => {
    const setting = await db.settings.get('reader.defaults');
    if (setting?.key === 'reader.defaults' && setting.value.remember === false)
      return;
    const book = await db.books.get(bookId);
    // 已删除书目不能被迟到的保存重新创建，也不能产生孤立进度。
    if (!book || book.pageCount <= 0) return;
    const previous = await db.progress.get(bookId);
    const updatedAt = Math.max(
      now,
      (previous?.updatedAt ?? 0) + 1,
      (book.lastReadAt ?? 0) + 1,
    );
    await db.progress.put({
      bookId,
      page: progressAnchor(page, book.pageCount),
      offset:
        progressAnchor(page, book.pageCount) === clampPage(page, book.pageCount)
          ? clampOffset(offset)
          : 0,
      updatedAt,
    });
    await db.books.update(bookId, { lastReadAt: updatedAt });
  });
}
/** 同一阅读会话按显示顺序写入；失败不阻断后续页，退出等待最后一次持久化。 */
export class ProgressWriter {
  private tail: Promise<void> = Promise.resolve();
  private latest: { page: number; offset: number } | null = null;
  private policyVersion = 0;
  constructor(
    private db: ComicDatabase,
    private bookId: string,
    private remember = true,
  ) {}
  record(page: number, offset = 0): Promise<void> {
    if (!this.remember) return Promise.resolve();
    const version = this.policyVersion;
    this.latest = { page, offset };
    this.tail = this.tail
      .catch(() => undefined)
      .then(() =>
        this.remember && version === this.policyVersion
          ? saveReadingProgress(this.db, this.bookId, page, Date.now(), offset)
          : undefined,
      );
    return this.tail;
  }
  flush(): Promise<void> {
    return this.tail;
  }
  /** 已提交的旧记录保留；失效尚未开始的写入，关闭后不再重试旧失败。 */
  setRemember(enabled: boolean): Promise<void> {
    this.remember = enabled;
    this.policyVersion++;
    this.latest = null;
    this.tail = this.tail.catch(() => undefined);
    return this.tail;
  }
  retry(): Promise<void> {
    return this.latest === null
      ? this.flush()
      : this.record(this.latest.page, this.latest.offset);
  }
}
