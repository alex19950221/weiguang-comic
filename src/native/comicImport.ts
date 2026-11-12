import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type { ImportSource } from '@/db/models';

export interface ImportProgress {
  jobId: string;
  copied: number;
  total: number;
}

/** uri 是原生文件选择器生成的临时标识，不允许网页传任意外部路径。 */
export interface ComicImportPlugin {
  pickFiles(): Promise<{ items: ImportSource[] }>;
  copyToLibrary(options: {
    jobId: string;
    bookId: string;
    item: ImportSource;
  }): Promise<{ path: string; size: number }>;
  /** 保存书签；fingerprint 仅在重新授权已有原位书时传入，原生匹配成功才替换授权。 */
  linkToLibrary(options: {
    bookId: string;
    item: ImportSource;
    fingerprint?: string;
    format?: string;
  }): Promise<{ path: string; size: number }>;
  cancel(options: { jobId: string }): Promise<void>;
  /** 仅清理指定 UUID 的应用副本、书签与临时文件，绝不删除源文件。 */
  removeCopy(options: { bookId: string }): Promise<void>;
  releaseSources(options: { uris: string[] }): Promise<void>;
  /** 取走从其他 App「用…打开」进来的文件；标识释放时原生删除系统 Inbox 里的副本。 */
  takeOpenedFiles(): Promise<{ items: ImportSource[] }>;
  addListener(
    event: 'progress',
    listener: (event: ImportProgress) => void,
  ): Promise<PluginListenerHandle>;
  /** 只表示有新文件到达，随后调用 takeOpenedFiles 取。 */
  addListener(
    event: 'filesOpened',
    listener: () => void,
  ): Promise<PluginListenerHandle>;
}

export const ComicImport = registerPlugin<ComicImportPlugin>('ComicImport');
export const supportsImport = () =>
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('ComicImport') &&
  Capacitor.isPluginAvailable('ComicArchive');
