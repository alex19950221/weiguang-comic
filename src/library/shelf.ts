import type { Book, Progress, Series } from '@/db/models';
import {
  compareTitles,
  readingState,
  seriesReadingState,
  type ReadingState,
} from './series';

export type ShelfSort = 'title' | 'importedAt' | 'lastReadAt';
export type ShelfFilter = 'all' | ReadingState;
export interface ShelfEntry {
  series: Series;
  books: Book[];
  current: Book;
  state: ReadingState;
  finished: number;
  lastRead: number;
  importedAt: number;
  size: number;
}
export const bookState = (
  book: Book,
  progress: ReadonlyMap<string, Progress>,
) => readingState(progress.get(book.id)?.page, book.pageCount);
export function bookPercent(
  book: Book,
  progress: ReadonlyMap<string, Progress>,
): number {
  const page = progress.get(book.id)?.page;
  return page === undefined || book.pageCount <= 0
    ? 0
    : Math.min(
        100,
        Math.max(0, Math.round(((page + 1) / book.pageCount) * 100)),
      );
}
export const bookReadAt = (
  book: Book,
  progress: ReadonlyMap<string, Progress>,
) => progress.get(book.id)?.updatedAt ?? book.lastReadAt ?? 0;
export function buildShelf(
  books: readonly Book[],
  series: readonly Series[],
  progress: ReadonlyMap<string, Progress>,
  /** 隐藏的系列（Pro）默认不出现在书架、最近、继续阅读和搜索中。 */
  showHidden = false,
): ShelfEntry[] {
  const bySeries = new Map<string, Book[]>();
  for (const book of books) {
    if (!book.seriesId) continue;
    const items = bySeries.get(book.seriesId) ?? [];
    items.push(book);
    bySeries.set(book.seriesId, items);
  }
  return series
    .filter((item) => (showHidden || !item.hidden) && bySeries.has(item.id))
    .map((item) => {
      const items = bySeries.get(item.id)!.sort((a, b) => {
        const left = a.unit === '话' ? a.chapter : a.volume;
        const right = b.unit === '话' ? b.chapter : b.volume;
        return left !== null && right !== null
          ? left - right ||
              compareTitles(a.fileName ?? a.title, b.fileName ?? b.title)
          : left !== null
            ? -1
            : right !== null
              ? 1
              : compareTitles(a.fileName ?? a.title, b.fileName ?? b.title);
      });
      const states = items.map((book) => bookState(book, progress));
      const reading = items
        .filter((book) => bookState(book, progress) === 'reading')
        .sort((a, b) => bookReadAt(b, progress) - bookReadAt(a, progress))[0];
      return {
        series: item,
        books: items,
        current:
          reading ??
          items.find((book) => bookState(book, progress) !== 'finished') ??
          items[0]!,
        state: seriesReadingState(states),
        finished: states.filter((x) => x === 'finished').length,
        lastRead: Math.max(
          0,
          ...items.map((book) => bookReadAt(book, progress)),
        ),
        importedAt: Math.max(...items.map((book) => book.importedAt)),
        size: items.reduce((sum, book) => sum + book.sizeBytes, 0),
      };
    });
}
export interface ShelfOptions {
  group: string;
  favorites: boolean;
  recent: boolean;
  filter: ShelfFilter;
  query: string;
  sort: ShelfSort;
}
export function selectShelf(
  entries: readonly ShelfEntry[],
  options: ShelfOptions,
) {
  const grouped = entries.filter(
    (entry) =>
      options.group === 'all' ||
      (options.group === 'none'
        ? entry.series.groupId === null
        : entry.series.groupId === options.group),
  );
  const favoriteCount = grouped.filter(
    (entry) => entry.series.favoritedAt !== null,
  ).length;
  const scope = grouped.filter(
    (entry) =>
      (!options.favorites || entry.series.favoritedAt !== null) &&
      (!options.recent || entry.lastRead > 0),
  );
  const counts: Record<ShelfFilter, number> = {
    all: scope.length,
    reading: 0,
    unread: 0,
    finished: 0,
  };
  for (const entry of scope) counts[entry.state]++;
  const needle = options.query.normalize('NFKC').trim().toLowerCase();
  const visible = scope
    .filter(
      (entry) =>
        (options.filter === 'all' || entry.state === options.filter) &&
        (!needle ||
          [
            entry.series.title,
            ...entry.books.flatMap((book) => [book.title, book.fileName ?? '']),
          ].some((text) =>
            text.normalize('NFKC').toLowerCase().includes(needle),
          )),
    )
    .sort((a, b) => {
      const delta =
        options.recent || options.sort === 'lastReadAt'
          ? b.lastRead - a.lastRead || b.importedAt - a.importedAt
          : options.sort === 'importedAt'
            ? b.importedAt - a.importedAt
            : compareTitles(a.series.title, b.series.title);
      return delta || a.series.id.localeCompare(b.series.id);
    });
  return { visible, counts, favoriteCount };
}
export function continuingBooks(
  entries: readonly ShelfEntry[],
  progress: ReadonlyMap<string, Progress>,
): Book[] {
  return entries
    .flatMap((entry) => entry.books)
    .filter((book) => bookState(book, progress) === 'reading')
    .sort(
      (a, b) =>
        bookReadAt(b, progress) - bookReadAt(a, progress) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 3);
}
