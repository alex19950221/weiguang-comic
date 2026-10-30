import { ComicArchive, localPageUrl } from '@/native/comicArchive';
import type { RenderedPage } from '@/native/comicArchive';
import type { ComicPage } from '@/archive/pageList';
interface PageSource {
  bookId: string;
  path: string;
}

type PageRenderer = (
  options: Parameters<typeof ComicArchive.renderPage>[0],
) => Promise<RenderedPage>;

/** 串行原生请求；最多保留当前页和相邻两页，翻页后丢弃过期任务。 */
export class PageLoader {
  private pages = new Map<number, RenderedPage>();
  private version = 0;
  private window = new Set([0, 1]);
  private disposed = false;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private book: PageSource,
    private list: readonly ComicPage[],
    private renderPage: PageRenderer = async (options) =>
      localPageUrl(await ComicArchive.renderPage(options)),
  ) {}

  move(center: number) {
    return this.moveWindow([center, center + 1, center - 1]);
  }

  /** 双页优先保留当前两页和后面一页；任何模式最多三张降采样图。 */
  moveWindow(indices: readonly number[]) {
    this.window = new Set(
      [...new Set(indices.filter((index) => !!this.list[index]))].slice(0, 3),
    );
    this.version++;
    for (const index of this.pages.keys()) {
      if (!this.window.has(index)) this.pages.delete(index);
    }
    return this.version;
  }

  get(index: number) {
    return this.pages.get(index);
  }

  clear() {
    this.version++;
    this.pages.clear();
  }

  load(
    index: number,
    maxPixel: number,
    version: number,
  ): Promise<RenderedPage | undefined> {
    const page = this.list[index];
    if (
      !page ||
      this.disposed ||
      version !== this.version ||
      !this.window.has(index)
    )
      return Promise.resolve(undefined);
    const cached = this.pages.get(index);
    if (cached) return Promise.resolve(cached);
    const task = this.queue
      .catch(() => undefined)
      .then(async () => {
        if (this.disposed || version !== this.version) return undefined;
        const result = await this.renderPage({
          bookId: this.book.bookId,
          path: this.book.path,
          entry: page.entry,
          maxPixel,
        });
        if (this.disposed || version !== this.version) return undefined;
        this.pages.set(index, result);
        return result;
      });
    this.queue = task;
    return task;
  }

  dispose() {
    this.disposed = true;
    this.clear();
  }
}
