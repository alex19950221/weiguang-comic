import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';
import type { ComicDatabase } from '@/db/schema';
import type {
  Book,
  Series,
  Progress,
  LibraryGroup,
  ImportJob,
  FileCleanupJob,
  Setting,
} from '@/db/models';
export interface ShelfSnapshot {
  books: Book[];
  series: Series[];
  progress: Progress[];
  groups: LibraryGroup[];
  jobs: ImportJob[];
  cleanup: FileCleanupJob[];
  settings: Setting[];
}
const empty: ShelfSnapshot = {
  books: [],
  series: [],
  progress: [],
  groups: [],
  jobs: [],
  cleanup: [],
  settings: [],
};
export function useShelf(db: ComicDatabase) {
  const [snapshot, setSnapshot] = useState(empty);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const subscription = liveQuery(() =>
      db.transaction(
        'r',
        [
          db.books,
          db.series,
          db.progress,
          db.libraryGroups,
          db.imports,
          db.fileCleanup,
          db.settings,
        ],
        async () => ({
          books: await db.books.toArray(),
          series: await db.series.toArray(),
          progress: await db.progress.toArray(),
          groups: await db.libraryGroups.orderBy('order').toArray(),
          jobs: (await db.imports.toArray()).sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
          cleanup: await db.fileCleanup.toArray(),
          settings: await db.settings.toArray(),
        }),
      ),
    ).subscribe({
      next: (next) => {
        setSnapshot(next);
        setState('ready');
      },
      error: () => setState('error'),
    });
    return () => subscription.unsubscribe();
  }, [db, attempt]);
  return {
    snapshot,
    state,
    retry: () => {
      setState('loading');
      setAttempt((x) => x + 1);
    },
  };
}
