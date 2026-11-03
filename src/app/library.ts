import { signal } from '@preact/signals';
import { database, openLibraryDatabase } from '@/db';
import { ComicArchive } from '@/native/comicArchive';
import { ComicImport, supportsImport } from '@/native/comicImport';
import { resetNativeDisplay } from '@/native/comicReader';
import type { ImportProgress } from '@/native/comicImport';
import { ImportQueue } from '@/library/ImportQueue';
import type { Book } from '@/db/models';
import { proStore } from './pro';
import { canPerform } from './proPolicy';

export const importProgress = signal<Record<string, ImportProgress>>({});
export const importError = signal<string | null>(null);
export const pickingFiles = signal(false);

export const importQueue = new ImportQueue(
  database,
  ComicArchive,
  ComicImport,
  (event) => {
    importProgress.value = { [event.jobId]: event };
  },
  (error) => {
    console.error('Library import queue failed', error);
    importError.value = '暂时无法继续导入，请关闭后重新打开应用。';
  },
);

let initializing: Promise<void> | null = null;
let initialized = false;
export async function initializeLibrary() {
  if (initialized) return;
  if (!initializing) {
    initializing = (async () => {
      void resetNativeDisplay();
      await openLibraryDatabase();
      if (supportsImport()) await importQueue.recover();
      initialized = true;
    })().finally(() => {
      initializing = null;
    });
  }
  await initializing;
}

export async function pickComics(location: Book['location'] = 'copy') {
  if (pickingFiles.value || !supportsImport()) return;
  if (
    location === 'inplace' &&
    !canPerform('inplace.add', proStore().state.value.status === 'pro')
  )
    return;
  pickingFiles.value = true;
  importError.value = null;
  let uris: string[] = [];
  try {
    const { items } = await ComicImport.pickFiles();
    uris = items.map((item) => item.uri);
    if (items.length)
      await importQueue.enqueue(
        items,
        location,
        proStore().state.value.status === 'pro',
      );
  } catch {
    importError.value = '暂时无法导入，请重新选择文件。';
    if (uris.length)
      await ComicImport.releaseSources({ uris }).catch(() => undefined);
  } finally {
    pickingFiles.value = false;
  }
}

/** 重新选择原件不要求 Pro；原生验证内容身份后才替换授权，书目、页序与进度均保留。 */
export async function relinkComic(book: Book): Promise<boolean> {
  if (book.location !== 'inplace' || pickingFiles.value || !supportsImport())
    return false;
  pickingFiles.value = true;
  let uris: string[] = [];
  try {
    const { items } = await ComicImport.pickFiles();
    uris = items.map((item) => item.uri);
    if (!items.length) return false;
    if (items.length !== 1) throw new Error('请只选择这本书的原文件。');
    await ComicImport.linkToLibrary({
      bookId: book.id,
      item: items[0]!,
      fingerprint: book.fingerprint,
      format: book.format,
    });
    await ComicArchive.clearCache({ bookId: book.id });
    await database.books.update(book.id, {
      status: 'ready',
      sourceUpdatedAt: Date.now(),
    });
    return true;
  } finally {
    await ComicImport.releaseSources({ uris }).catch(() => undefined);
    pickingFiles.value = false;
  }
}
