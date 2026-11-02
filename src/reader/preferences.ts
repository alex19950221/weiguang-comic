import type { ReaderDefaults } from '@/db/models';
import type { ComicDatabase } from '@/db/schema';
import { readerBrightness } from './appearance';

/** 自动裁白边按书保存；只改这本书的记录，不影响其他书和默认设置。 */
export async function saveCropBorders(
  db: ComicDatabase,
  bookId: string,
  enabled: boolean,
): Promise<void> {
  const updated = await db.books.update(bookId, { cropBorders: enabled });
  if (!updated && !(await db.books.get(bookId)))
    throw new Error('BOOK_MISSING');
}

/** 默认值与当前书的覆盖设置一起提交；失败时界面保持原选择。 */
export async function saveReaderPreferences(
  db: ComicDatabase,
  bookId: string,
  patch: Partial<ReaderDefaults>,
): Promise<ReaderDefaults> {
  return db.transaction('rw', [db.books, db.settings], async () => {
    const book = await db.books.get(bookId);
    if (!book) throw new Error('BOOK_MISSING');
    const stored = await db.settings.get('reader.defaults');
    const previous =
      stored?.key === 'reader.defaults'
        ? stored.value
        : {
            direction: 'ltr' as const,
            mode: 'paged' as const,
            background: 'system' as const,
          };
    const next: ReaderDefaults = {
      ...previous,
      ...patch,
      ...(patch.brightness !== undefined
        ? { brightness: readerBrightness(patch.brightness) }
        : {}),
    };
    await db.settings.put({ key: 'reader.defaults', value: next });
    await db.books.update(bookId, {
      ...(patch.mode ? { mode: patch.mode } : {}),
      ...(patch.direction ? { direction: patch.direction } : {}),
      ...(patch.spreadCover
        ? {
            spreadOffset:
              patch.spreadCover === 'alone' ? (0 as const) : (1 as const),
          }
        : {}),
    });
    return next;
  });
}
