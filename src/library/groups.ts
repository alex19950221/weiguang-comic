import type { LibraryGroup } from '@/db/models';
import type { ComicDatabase } from '@/db/schema';

export type GroupErrorCode =
  | 'GROUP_NAME_REQUIRED'
  | 'GROUP_NAME_TOO_LONG'
  | 'GROUP_NAME_EXISTS'
  | 'GROUP_NOT_FOUND'
  | 'SERIES_NOT_FOUND';
export class GroupError extends Error {
  constructor(readonly code: GroupErrorCode) {
    super(code);
    this.name = 'GroupError';
  }
}

function groupName(value: string): { name: string; nameKey: string } {
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) throw new GroupError('GROUP_NAME_REQUIRED');
  // 与已确认原型的输入框上限一致。
  if (name.length > 20) throw new GroupError('GROUP_NAME_TOO_LONG');
  return { name, nameKey: name.normalize('NFKC').toLowerCase() };
}

export async function createLibraryGroup(
  db: ComicDatabase,
  value: string,
): Promise<LibraryGroup> {
  const names = groupName(value);
  return db.transaction('rw', db.libraryGroups, async () => {
    const existing = await db.libraryGroups
      .where('nameKey')
      .equals(names.nameKey)
      .first();
    if (existing) return existing;
    const last = await db.libraryGroups.orderBy('order').last();
    const now = Date.now();
    const group: LibraryGroup = {
      id: crypto.randomUUID(),
      ...names,
      order: (last?.order ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.libraryGroups.add(group);
    return group;
  });
}

export async function renameLibraryGroup(
  db: ComicDatabase,
  id: string,
  value: string,
): Promise<void> {
  const names = groupName(value);
  await db.transaction('rw', db.libraryGroups, async () => {
    const group = await db.libraryGroups.get(id);
    if (!group) throw new GroupError('GROUP_NOT_FOUND');
    const duplicate = await db.libraryGroups
      .where('nameKey')
      .equals(names.nameKey)
      .first();
    if (duplicate && duplicate.id !== id)
      throw new GroupError('GROUP_NAME_EXISTS');
    await db.libraryGroups.update(id, { ...names, updatedAt: Date.now() });
  });
}

export async function moveSeriesToGroup(
  db: ComicDatabase,
  seriesId: string,
  groupId: string | null,
): Promise<void> {
  await db.transaction('rw', [db.series, db.libraryGroups], async () => {
    if (!(await db.series.get(seriesId)))
      throw new GroupError('SERIES_NOT_FOUND');
    if (groupId !== null && !(await db.libraryGroups.get(groupId)))
      throw new GroupError('GROUP_NOT_FOUND');
    await db.series.update(seriesId, { groupId, updatedAt: Date.now() });
  });
}

/** 删除分组只将系列移回未分组，不删除书籍、进度或原生文件。 */
export async function deleteLibraryGroup(
  db: ComicDatabase,
  id: string,
): Promise<void> {
  await db.transaction('rw', [db.series, db.libraryGroups], async () => {
    await db.series
      .where('groupId')
      .equals(id)
      .modify({ groupId: null, updatedAt: Date.now() });
    await db.libraryGroups.delete(id);
  });
}
