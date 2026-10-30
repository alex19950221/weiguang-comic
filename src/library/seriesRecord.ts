import type { Series } from '@/db/models';
import { seriesKey } from './series';

/** 全为分隔符的书名不相互合并，回退到各自稳定的书籍/系列标识。 */
export const persistedSeriesKey = (title: string, fallbackId: string) =>
  seriesKey(title) || `unparsed:${fallbackId}`;

export function createSeriesRecord(
  title: string,
  id: string,
  key: string,
  now: number,
): Series {
  return {
    id,
    key,
    title,
    sortKey: title.normalize('NFC').toLowerCase(),
    hidden: false,
    groupId: null,
    favoritedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
