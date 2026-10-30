import { signal } from '@preact/signals';
import { database, openLibraryDatabase } from '@/db';
import { ComicArchive } from '@/native/comicArchive';
import { ComicImport, supportsImport } from '@/native/comicImport';
import { resetNativeDisplay } from '@/native/comicReader';
import type { ImportProgress } from '@/native/comicImport';
import { ImportQueue } from '@/library/ImportQueue';

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

export async function pickComics() {
  if (pickingFiles.value || !supportsImport()) return;
  pickingFiles.value = true;
  importError.value = null;
  let uris: string[] = [];
  try {
    const { items } = await ComicImport.pickFiles();
    uris = items.map((item) => item.uri);
    if (items.length) await importQueue.enqueue(items);
  } catch {
    importError.value = '暂时无法导入，请重新选择文件。';
    if (uris.length)
      await ComicImport.releaseSources({ uris }).catch(() => undefined);
  } finally {
    pickingFiles.value = false;
  }
}
