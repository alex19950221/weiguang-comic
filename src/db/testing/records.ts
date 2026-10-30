import type { Book, Series } from '../models';
import type { BookV1, SeriesV1 } from '../migrations/v2';

/** 仅测试使用，不由正式入口加载；不包含真实用户或漫画数据。 */
export function legacyBook(patch: Partial<BookV1> = {}): BookV1 {
  return {
    id: 'book-1',
    fingerprint: 'a'.repeat(64),
    title: '测试系列 第01卷',
    seriesId: null,
    volume: null,
    chapter: null,
    sortKey: 'test',
    format: 'zip',
    location: 'copy',
    path: '/private/test/book-1.zip',
    sizeBytes: 123,
    pageCount: 12,
    coverPage: 0,
    nameEncoding: 'utf-8',
    direction: null,
    mode: null,
    spreadOffset: 0,
    cropBorders: false,
    status: 'ready',
    importedAt: 100,
    lastReadAt: null,
    meta: null,
    ...patch,
  };
}
export function testBook(patch: Partial<Book> = {}): Book {
  return {
    ...legacyBook(),
    fileName: '测试系列 第01卷.zip',
    unit: '卷',
    ...patch,
  };
}
export function legacySeries(patch: Partial<SeriesV1> = {}): SeriesV1 {
  return {
    id: 'series-1',
    title: '测试系列',
    sortKey: 'test',
    hidden: false,
    createdAt: 50,
    updatedAt: 80,
    ...patch,
  };
}
export function testSeries(patch: Partial<Series> = {}): Series {
  return {
    ...legacySeries(),
    key: '测试系列',
    groupId: null,
    favoritedAt: null,
    ...patch,
  };
}
