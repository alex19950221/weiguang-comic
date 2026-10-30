import type { Transaction } from 'dexie';
import type { Book, ImportJob, Series } from '../models';
import { parseComicName } from '@/library/series';
import { createSeriesRecord, persistedSeriesKey } from '@/library/seriesRecord';

export type BookV1 = Omit<Book, 'fileName' | 'unit'>;
export type SeriesV1 = Omit<Series, 'key' | 'groupId' | 'favoritedAt'>;

/** 只在 Dexie 升级事务内修改元数据，不访问原生文件或执行外部异步任务。 */
export async function upgradeToV2(transaction: Transaction): Promise<void> {
  const oldBooks = await transaction.table<BookV1>('books').toArray();
  const oldSeries = await transaction.table<SeriesV1>('series').toArray();
  const imports = await transaction.table<ImportJob>('imports').toArray();
  const sourceNames = new Map<string, ImportJob>();
  for (const job of imports) {
    if (job.state !== 'done' || !job.source.name.trim()) continue;
    const existing = sourceNames.get(job.bookId);
    if (
      !existing ||
      job.updatedAt > existing.updatedAt ||
      (job.updatedAt === existing.updatedAt && job.id < existing.id)
    )
      sourceNames.set(job.bookId, job);
  }

  const byKey = new Map<string, Series>();
  const aliases = new Map<string, Series>();
  const usedIds = new Set(oldSeries.map((series) => series.id));
  // 同键旧系列保留最早创建者的 ID 和名称，其余关系重定向；不丢隐藏标记和时间。
  oldSeries.sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
  for (const item of oldSeries) {
    const key = persistedSeriesKey(item.title, item.id);
    let series = byKey.get(key);
    if (!series) {
      series = { ...item, key, groupId: null, favoritedAt: null };
      byKey.set(key, series);
    } else {
      series.hidden ||= item.hidden;
      series.createdAt = Math.min(series.createdAt, item.createdAt);
      series.updatedAt = Math.max(series.updatedAt, item.updatedAt);
    }
    aliases.set(item.id, series);
  }

  oldBooks.sort(
    (a, b) => a.importedAt - b.importedAt || a.id.localeCompare(b.id),
  );
  const books: Book[] = [];
  for (const book of oldBooks) {
    const fileName = sourceNames.get(book.id)?.source.name ?? null;
    const parsed = parseComicName(fileName ?? book.title);
    let series = book.seriesId ? aliases.get(book.seriesId) : undefined;
    const key = persistedSeriesKey(parsed.title, book.id);
    series ??= byKey.get(key);
    if (!series) {
      let id = `series:${book.id}`;
      for (let suffix = 1; usedIds.has(id); suffix++)
        id = `series:${book.id}:${suffix}`;
      usedIds.add(id);
      series = createSeriesRecord(parsed.title, id, key, book.importedAt);
      byKey.set(key, series);
    }
    series.updatedAt = Math.max(series.updatedAt, book.importedAt);
    const unit =
      book.chapter !== null && book.volume === null
        ? '话'
        : book.volume !== null
          ? '卷'
          : parsed.unit;
    books.push({
      ...book,
      fileName,
      unit,
      seriesId: series.id,
      // 旧的书名、卷/话号等可能已人工修正，只补空值。
      volume: book.volume ?? (unit === '卷' ? parsed.volume : null),
      chapter: book.chapter ?? (unit === '话' ? parsed.volume : null),
    });
  }

  const removedIds = oldSeries
    .filter((series) => aliases.get(series.id)?.id !== series.id)
    .map((series) => series.id);
  // 先移除被合并的旧行，再写入唯一系列键；整个升级失败会整体回滚。
  if (removedIds.length)
    await transaction.table('series').bulkDelete(removedIds);
  if (byKey.size)
    await transaction.table<Series>('series').bulkPut([...byKey.values()]);
  if (books.length) await transaction.table<Book>('books').bulkPut(books);
}
