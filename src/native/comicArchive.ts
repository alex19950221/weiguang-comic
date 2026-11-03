import { Capacitor, registerPlugin } from '@capacitor/core';
import type { ImageFilters } from '@/reader/filters';

export interface ArchiveEntry {
  index: number;
  name?: string;
  rawName?: string;
  size: number;
  isDirectory?: boolean;
  isSymlink?: boolean;
}

export interface Inspection {
  format: 'zip' | 'pdf' | 'epub' | 'rar' | '7z' | 'tar';
  encrypted: boolean;
  entries: ArchiveEntry[];
  /** 仅 EPUB：容器、OPF 与页面文档的文本，供网页层解析阅读顺序；不含图片。 */
  texts?: { index: number; text: string }[];
  /** 原生读到根目录 ComicInfo.xml 的 <Manga> 右翻标记时为 'rtl'，否则缺省。 */
  manga?: 'rtl';
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
    filters?: ImageFilters;
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
  /** 串行关闭归档、清缓存/书签，只按 UUID 删除应用副本；绝不接收源路径。 */
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
