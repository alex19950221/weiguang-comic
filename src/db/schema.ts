import Dexie from 'dexie';
import type { DexieOptions, EntityTable } from 'dexie';
import type {
  Book,
  Bookmark,
  ImportJob,
  PageList,
  PendingMatch,
  Progress,
  Series,
  Setting,
  LibraryGroup,
  FileCleanupJob,
} from './models';
import { upgradeToV2 } from './migrations/v2';

/** 已发布的版本定义保持不变；后续升级新增version，不删除或重建用户数据库。 */
export const schemaV1 = {
  books: '&id, fingerprint, seriesId, lastReadAt, importedAt, sortKey',
  series: '&id, sortKey, updatedAt',
  pageLists: '&bookId',
  progress: '&bookId, updatedAt',
  bookmarks: '&id, bookId, createdAt',
  imports: '&id, state',
  settings: '&key',
  pendingMatches: '&fingerprint',
} as const;

export const schemaV2 = {
  ...schemaV1,
  series: '&id, &key, groupId, favoritedAt, sortKey, updatedAt',
  imports: '&id, state, bookId',
  libraryGroups: '&id, &nameKey, order, updatedAt',
  fileCleanup: '&bookId, state, updatedAt',
} as const;

export class ComicDatabase extends Dexie {
  declare books: EntityTable<Book, 'id'>;
  declare series: EntityTable<Series, 'id'>;
  declare pageLists: EntityTable<PageList, 'bookId'>;
  declare progress: EntityTable<Progress, 'bookId'>;
  declare bookmarks: EntityTable<Bookmark, 'id'>;
  declare imports: EntityTable<ImportJob, 'id'>;
  declare settings: EntityTable<Setting, 'key'>;
  declare pendingMatches: EntityTable<PendingMatch, 'fingerprint'>;
  declare libraryGroups: EntityTable<LibraryGroup, 'id'>;
  declare fileCleanup: EntityTable<FileCleanupJob, 'bookId'>;

  constructor(name = 'weiguang-comic', options: DexieOptions = {}) {
    super(name, { ...options, autoOpen: false });
    this.version(1).stores(schemaV1);
    this.version(2).stores(schemaV2).upgrade(upgradeToV2);
    // populate只在首次建库执行，不会在重开或升级时覆盖用户设置。
    this.on('populate', () =>
      this.settings.bulkAdd([
        {
          key: 'reader.defaults',
          value: { direction: 'ltr', mode: 'paged', background: 'system' },
        },
        { key: 'library.sort', value: 'lastReadAt' },
      ]),
    );
    // Dexie 4 会直接打开更高版本的库；旧版 App 不能读写新格式，拒绝打开但保留数据。
    this.on('ready', () => {
      const installed = this.backendDB().version;
      if (installed > Math.round(this.verno * 10)) {
        this.close();
        throw new Dexie.VersionError(
          `数据库版本 ${installed / 10} 高于当前 App 支持的 ${this.verno}`,
        );
      }
    });
  }
}

export const createDatabase = (name?: string, options?: DexieOptions) =>
  new ComicDatabase(name, options);
