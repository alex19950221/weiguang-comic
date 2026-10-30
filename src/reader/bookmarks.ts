import type { Bookmark } from '@/db/models';
import type { ComicDatabase } from '@/db/schema';
import { clampOffset } from './progress';
import type { ReadingPosition } from './layout';

export function sortedBookmarks(
  marks: readonly Bookmark[],
  count: number,
): Bookmark[] {
  return marks
    .filter(
      (mark) =>
        Number.isInteger(mark.page) && mark.page >= 0 && mark.page < count,
    )
    .map((mark) => ({ ...mark, offset: clampOffset(mark.offset) }))
    .sort(
      (a, b) =>
        a.page - b.page ||
        a.offset - b.offset ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}
/** 一页一个书签；书签保存准确位置，不使用“末两页记末页”的阅读完成锚点。 */
export async function toggleBookmark(
  db: ComicDatabase,
  bookId: string,
  position: ReadingPosition,
  now = Date.now(),
  id: string = crypto.randomUUID(),
): Promise<boolean> {
  return db.transaction('rw', [db.books, db.bookmarks], async () => {
    const book = await db.books.get(bookId);
    if (!book || book.status !== 'ready') throw new Error('BOOK_UNAVAILABLE');
    if (
      !Number.isInteger(position.page) ||
      position.page < 0 ||
      position.page >= book.pageCount
    )
      throw new Error('INVALID_POSITION');
    const matches = (
      await db.bookmarks.where('bookId').equals(bookId).toArray()
    ).filter((mark) => mark.page === position.page);
    if (matches.length) {
      await db.bookmarks.bulkDelete(matches.map((mark) => mark.id));
      return false;
    }
    await db.bookmarks.add({
      id,
      bookId,
      page: position.page,
      offset: clampOffset(position.offset),
      note: '',
      createdAt: now,
      updatedAt: now,
    });
    return true;
  });
}
export async function removeBookmark(
  db: ComicDatabase,
  bookId: string,
  id: string,
): Promise<void> {
  await db.transaction('rw', db.bookmarks, async () => {
    const mark = await db.bookmarks.get(id);
    if (mark?.bookId === bookId) await db.bookmarks.delete(id);
  });
}
