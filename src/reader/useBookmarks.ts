import { liveQuery } from 'dexie';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComicDatabase } from '@/db/schema';
import type { Bookmark } from '@/db/models';
import { sortedBookmarks, toggleBookmark, removeBookmark } from './bookmarks';
import type { ReadingPosition } from './layout';

export function useBookmarks(db: ComicDatabase, bookId: string, count: number) {
  const [marks, setMarks] = useState<Bookmark[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState(false),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const mounted = useRef(true),
    locked = useRef(false);
  const lastAction = useRef<(() => Promise<unknown>) | null>(null);
  useEffect(() => {
    mounted.current = true;
    const subscription = liveQuery(() =>
      db.bookmarks.where('bookId').equals(bookId).toArray(),
    ).subscribe({
      next: (values) => {
        setMarks(sortedBookmarks(values, count));
        setState('ready');
      },
      error: () => setState('error'),
    });
    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, [db, bookId, count, attempt]);
  async function mutate(action: () => Promise<unknown>) {
    if (locked.current) return;
    lastAction.current = action;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      await action();
    } catch {
      if (mounted.current) setError(true);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return {
    marks,
    state,
    error,
    busy,
    locked,
    toggle: (position: ReadingPosition) =>
      mutate(() => toggleBookmark(db, bookId, position)),
    remove: (id: string) => mutate(() => removeBookmark(db, bookId, id)),
    retry: () => {
      setState('loading');
      setAttempt((value) => value + 1);
    },
    retryMutation: () =>
      lastAction.current ? mutate(lastAction.current) : Promise.resolve(),
  };
}
