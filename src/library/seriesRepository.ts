import type { Series } from '@/db/models';
import type { ComicDatabase } from '@/db/schema';
import { createSeriesRecord, persistedSeriesKey } from './seriesRecord';

/** 可独立使用，也可加入导入事务；唯一键和串行写事务避免并发创建重复系列。 */
export function ensureSeries(
  db: ComicDatabase,
  title: string,
  bookId: string,
  now: number,
): Promise<Series> {
  return db.transaction('rw', db.series, async () => {
    const key = persistedSeriesKey(title, bookId);
    const existing = await db.series.where('key').equals(key).first();
    if (existing) {
      const updatedAt = Math.max(existing.updatedAt, now);
      await db.series.update(existing.id, { updatedAt });
      return { ...existing, updatedAt };
    }
    const series = createSeriesRecord(title, crypto.randomUUID(), key, now);
    await db.series.add(series);
    return series;
  });
}
