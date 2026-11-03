import type { ComicDatabase } from '@/db/schema';
import type { Book } from '@/db/models';
import { canPerform } from '@/app/proPolicy';
import {
  deleteLibraryTarget,
  markTargetRead,
  targetBooks,
  type LibraryTarget,
} from './actions';
import { GroupError, moveSeriesToGroup } from './groups';

export type BatchAction =
  | { kind: 'move'; groupId: string | null }
  | { kind: 'read'; finished: boolean }
  | { kind: 'delete' };

export interface BatchSelection {
  targets: readonly LibraryTarget[];
  /** 用户确认时看到的实际书目，避免导入/删除并发后处理未确认的卷。 */
  bookIds: readonly string[];
}

export class BatchError extends Error {
  constructor(readonly code: 'PRO_REQUIRED' | 'SELECTION_CHANGED') {
    super(code);
    this.name = 'BatchError';
  }
}

/** 单一事务完成整理；原生清理只能在此 Promise 成功后交给 FileCleanupQueue。 */
export async function applyBatch(
  db: ComicDatabase,
  selection: BatchSelection,
  action: BatchAction,
  proActive: boolean,
): Promise<void> {
  if (!canPerform('batch.apply', proActive))
    throw new BatchError('PRO_REQUIRED');
  await db.transaction(
    'rw',
    [
      db.books,
      db.series,
      db.progress,
      db.pageLists,
      db.bookmarks,
      db.imports,
      db.pendingMatches,
      db.fileCleanup,
      db.libraryGroups,
    ],
    async () => {
      const books = new Map<string, Book>();
      for (const target of selection.targets) {
        const resolved = await targetBooks(db, target);
        if (!resolved.length) throw new BatchError('SELECTION_CHANGED');
        for (const book of resolved) books.set(book.id, book);
      }
      const expected = new Set(selection.bookIds);
      if (
        !books.size ||
        books.size !== expected.size ||
        [...books.keys()].some((id) => !expected.has(id))
      )
        throw new BatchError('SELECTION_CHANGED');
      if (action.kind === 'move') {
        const seriesIds = new Set<string>();
        for (const book of books.values()) {
          if (!book.seriesId) throw new GroupError('SERIES_NOT_FOUND');
          seriesIds.add(book.seriesId);
        }
        for (const id of seriesIds)
          await moveSeriesToGroup(db, id, action.groupId);
      } else {
        for (const id of books.keys()) {
          const target: LibraryTarget = { kind: 'book', id };
          if (action.kind === 'delete') await deleteLibraryTarget(db, target);
          else await markTargetRead(db, target, action.finished);
        }
      }
    },
  );
}
