import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ArchiveEntry {
  index: number;
  name?: string;
  rawName?: string;
  size: number;
  isDirectory?: boolean;
  isSymlink?: boolean;
}

export interface Inspection {
  format: 'zip' | 'rar' | '7z' | 'tar';
  encrypted: boolean;
  entries: ArchiveEntry[];
}

export interface RenderedPage {
  url: string;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  cached: boolean;
}

export interface ComicArchivePlugin {
  inspect(options: { path: string }): Promise<Inspection>;
  renderPage(options: {
    bookId: string;
    path: string;
    entry: number;
    maxPixel: number;
    crop?: boolean;
  }): Promise<RenderedPage>;
  thumbnail(options: {
    bookId: string;
    path: string;
    entry: number;
  }): Promise<RenderedPage>;
  fingerprint(options: {
    path: string;
  }): Promise<{ sha256: string; size: number }>;
  clearCache(options: { bookId?: string }): Promise<void>;
  /** 串行关闭归档、清缓存，只按 UUID 删除 ComicLibrary 中的副本；绝不接收源路径。 */
  disposeBook(options: { bookId: string; deleteCopy: boolean }): Promise<void>;
}

export const ComicArchive = registerPlugin<ComicArchivePlugin>('ComicArchive');
let renderRevision = 0;
export function localPageUrl(page: RenderedPage): RenderedPage {
  if (!page.url.startsWith('file://'))
    throw new Error('原生返回了无效的页面地址。');
  const url = Capacitor.convertFileSrc(page.url);
  // 重建过的同一路径不复用 WebView 中可能失效的旧图片响应。
  return {
    ...page,
    url: page.cached ? url : `${url}?render=${Date.now()}-${++renderRevision}`,
  };
}
