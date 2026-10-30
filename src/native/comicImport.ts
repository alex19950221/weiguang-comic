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
  cancel(options: { jobId: string }): Promise<void>;
  /** 仅清理指定 UUID 的应用副本与未完成临时文件，绝不删除源文件。 */
  removeCopy(options: { bookId: string }): Promise<void>;
  releaseSources(options: { uris: string[] }): Promise<void>;
  addListener(
    event: 'progress',
    listener: (event: ImportProgress) => void,
  ): Promise<PluginListenerHandle>;
}

export const ComicImport = registerPlugin<ComicImportPlugin>('ComicImport');
export const supportsImport = () =>
  Capacitor.isNativePlatform() &&
  Capacitor.isPluginAvailable('ComicImport') &&
  Capacitor.isPluginAvailable('ComicArchive');
