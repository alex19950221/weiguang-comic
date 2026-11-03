import type { ComicPage } from '@/archive/pageList';
import type { VolumeUnit } from '@/library/series';

export type BookFormat =
  'zip' | 'rar' | '7z' | 'tar' | 'folder' | 'pdf' | 'epub';
export type ReadingDirection = 'ltr' | 'rtl';
export type ReadingMode = 'paged' | 'scroll' | 'spread';

export interface ComicMetadata {
  title?: string;
  series?: string;
  number?: string;
  volume?: number;
  summary?: string;
  writer?: string;
  publisher?: string;
  language?: string;
  manga?: boolean;
}

export interface Book {
  id: string;
  fingerprint: string;
  title: string;
  /** 原文件名；v1 没有可追溯来源时为 null，不从私有 UUID 路径猜测。 */
  fileName: string | null;
  unit: VolumeUnit;
  seriesId: string | null;
  volume: number | null;
  chapter: number | null;
  sortKey: string;
  format: BookFormat;
  location: 'copy' | 'inplace';
  /** 原生层管理的副本路径或原位访问标识，不存文件本体。 */
  path: string;
  /** 本机重选原件后刷新封面；旧书缺省，不参与阅读进度或排序。 */
  sourceUpdatedAt?: number;
  sizeBytes: number;
  pageCount: number;
  /** 排序后页目录的下标，从0开始。 */
  coverPage: number;
  nameEncoding: string;
  direction: ReadingDirection | null;
  mode: ReadingMode | null;
  spreadOffset: 0 | 1;
  cropBorders: boolean;
  status: 'ready' | 'missing' | 'error';
  importedAt: number;
  lastReadAt: number | null;
  meta: ComicMetadata | null;
}

export interface Series {
  id: string;
  key: string;
  title: string;
  sortKey: string;
  hidden: boolean;
  groupId: string | null;
  favoritedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface LibraryGroup {
  id: string;
  name: string;
  nameKey: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

/** 删除事务提交后由原生清理副本，失败保留任务用于重试。 */
export interface FileCleanupJob {
  bookId: string;
  location: Book['location'];
  state: 'pending' | 'failed';
  attempts: number;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PageList {
  bookId: string;
  pages: ComicPage[];
  updatedAt: number;
}

export interface Progress {
  bookId: string;
  /** 页下标从0开始；offset是页内0–1位置。 */
  page: number;
  offset: number;
  updatedAt: number;
}

export interface Bookmark extends Progress {
  id: string;
  note: string;
  createdAt: number;
}

export interface ImportSource {
  uri: string;
  name: string;
  size: number;
  isDirectory: boolean;
  relativePath?: string;
}

export type ImportState =
  | 'queued'
  | 'copying'
  | 'inspecting'
  | 'saving'
  | 'done'
  | 'duplicate'
  | 'failed'
  | 'cancelled';

export interface ImportJob {
  id: string;
  state: ImportState;
  source: ImportSource;
  bookId: string;
  /** 旧任务缺省为复制；原位任务仅保存原生书签。 */
  location?: Book['location'];
  copiedBytes: number;
  /** 成功复制后才写入原生副本路径。 */
  path: string | null;
  error: string | null;
  /** 清理失败时保留任务，下一次打开继续清理应用副本。 */
  cleanupPending?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ReaderDefaults {
  direction: ReadingDirection;
  mode: ReadingMode;
  background: 'system' | 'white' | 'black';
  /** 旧设置缺少此字段时封面单独显示；无需改变表结构。 */
  spreadCover?: 'alone' | 'paired';
  fit?: 'page' | 'width';
  brightness?: number;
  /** 旧设置缺省为开启；关闭不清除以前的阅读位置。 */
  remember?: boolean;
  autoplayInterval?: number;
  autoplaySpeed?: number;
}

export type Setting =
  | { key: 'reader.defaults'; value: ReaderDefaults }
  | { key: 'reader.tap-hint-seen'; value: boolean }
  | { key: 'library.layout'; value: 'grid' | 'list' }
  | { key: 'ui.appearance'; value: 'system' | 'paper' | 'night' }
  | { key: 'library.sort'; value: 'title' | 'importedAt' | 'lastReadAt' }
  /** 应用锁（Pro）；缺省为关闭。失去 Pro 后仍可解锁与关闭。 */
  | { key: 'app.lock'; value: boolean };

/** 备份未匹配记录不携带另一台设备的文件路径。匹配时再分配本机bookId。 */
export interface PendingMatch {
  fingerprint: string;
  // 兼容旧备份的嵌入书目；恢复匹配入库时再补齐 v2 新字段。
  book: Omit<
    Book,
    'id' | 'path' | 'location' | 'status' | 'fileName' | 'unit'
  > &
    Partial<Pick<Book, 'fileName' | 'unit'>>;
  progress: Omit<Progress, 'bookId'> | null;
  bookmarks: Omit<Bookmark, 'bookId'>[];
  updatedAt: number;
}
