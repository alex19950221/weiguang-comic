import type { ComicDatabase } from '@/db/schema';
export type LibraryTarget = { kind: 'book' | 'series'; id: string };

export async function targetBooks(db: ComicDatabase, target: LibraryTarget) {
  return target.kind === 'series'
    ? db.books.where('seriesId').equals(target.id).toArray()
    : db.books.where('id').equals(target.id).toArray();
}
export async function markTargetRead(
  db: ComicDatabase,
  target: LibraryTarget,
  finished: boolean,
): Promise<void> {
  await db.transaction('rw', [db.books, db.progress], async () => {
    const books = await targetBooks(db, target);
    const now = Date.now();
    for (const book of books) {
      if (finished) {
        await db.progress.put({
          bookId: book.id,
          page: Math.max(0, book.pageCount - 1),
          offset: 0,
          updatedAt: now,
        });
        await db.books.update(book.id, { lastReadAt: now });
      } else {
        await db.progress.delete(book.id);
        await db.books.update(book.id, { lastReadAt: null });
      }
    }
  });
}
export async function toggleSeriesFavorite(
  db: ComicDatabase,
  id: string,
): Promise<void> {
  await db.transaction('rw', db.series, async () => {
    const series = await db.series.get(id);
    if (series)
      await db.series.update(id, {
        favoritedAt: series.favoritedAt === null ? Date.now() : null,
        updatedAt: Date.now(),
      });
  });
}

/** 隐藏或取消隐藏系列；取消隐藏不需要 Pro（失去权益不丢数据）。 */
export async function setSeriesHidden(
  db: ComicDatabase,
  id: string,
  hidden: boolean,
): Promise<void> {
  const updated = await db.series.update(id, {
    hidden,
    updatedAt: Date.now(),
  });
  if (!updated && !(await db.series.get(id))) throw new Error('SERIES_MISSING');
}

/** 文件系统和 IndexedDB 无法共用事务，先持久化清理任务，再由原生幂等清理。 */
export async function deleteLibraryTarget(
  db: ComicDatabase,
  target: LibraryTarget,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.books,
      db.series,
      db.pageLists,
      db.progress,
      db.bookmarks,
      db.imports,
      db.pendingMatches,
      db.fileCleanup,
    ],
    async () => {
      const books = await targetBooks(db, target);
      const now = Date.now();
      for (const book of books) {
        await db.fileCleanup.put({
          bookId: book.id,
          location: book.location,
          state: 'pending',
          attempts: 0,
          error: null,
          createdAt: now,
          updatedAt: now,
        });
        await db.pageLists.delete(book.id);
        await db.progress.delete(book.id);
        await db.bookmarks.where('bookId').equals(book.id).delete();
        await db.imports.where('bookId').equals(book.id).delete();
        await db.pendingMatches.delete(book.fingerprint);
        await db.books.delete(book.id);
      }
      const ids = new Set(
        books.flatMap((book) => (book.seriesId ? [book.seriesId] : [])),
      );
      if (target.kind === 'series') ids.add(target.id);
      for (const id of ids)
        if (!(await db.books.where('seriesId').equals(id).count()))
          await db.series.delete(id);
    },
  );
}
