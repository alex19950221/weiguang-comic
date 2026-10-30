import type { ComicPage } from '@/archive/pageList';
import type { RenderedPage, ComicArchivePlugin } from '@/native/comicArchive';

interface Job {
  index: number;
  wanted: () => boolean;
  resolve: (image: RenderedPage | undefined) => void;
  reject: (error: unknown) => void;
}
/** 只向原生队列发送一个请求；关闭或离开可见范围后，尚未开始的任务不解码。 */
export class ThumbnailLoader {
  private cache = new Map<number, RenderedPage>();
  private pending = new Map<number, Promise<RenderedPage | undefined>>();
  private wanted = new Map<number, () => boolean>();
  private queue: Job[] = [];
  private active = false;
  private disposed = false;
  constructor(
    private book: { id: string; path: string },
    private pages: readonly ComicPage[],
    private render: ComicArchivePlugin['thumbnail'],
  ) {}
  load(
    index: number,
    wanted: () => boolean = () => true,
  ): Promise<RenderedPage | undefined> {
    if (this.disposed || !this.pages[index] || !wanted())
      return Promise.resolve(undefined);
    const cached = this.cache.get(index);
    if (cached) {
      this.cache.delete(index);
      this.cache.set(index, cached);
      return Promise.resolve(cached);
    }
    const existing = this.pending.get(index);
    if (existing) {
      const previous = this.wanted.get(index);
      this.wanted.set(index, () => wanted() || previous?.() === true);
      return existing;
    }
    this.wanted.set(index, wanted);
    const promise = new Promise<RenderedPage | undefined>((resolve, reject) =>
      this.queue.push({
        index,
        wanted: () => this.wanted.get(index)?.() === true,
        resolve,
        reject,
      }),
    );
    this.pending.set(index, promise);
    void this.pump();
    return promise;
  }
  private async pump() {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        if (this.disposed || !job.wanted()) {
          this.pending.delete(job.index);
          this.wanted.delete(job.index);
          job.resolve(undefined);
          continue;
        }
        try {
          const image = await this.render({
            bookId: this.book.id,
            path: this.book.path,
            entry: this.pages[job.index]!.entry,
          });
          if (!this.disposed) {
            this.cache.set(job.index, image);
            while (this.cache.size > 24)
              this.cache.delete(this.cache.keys().next().value!);
          }
          job.resolve(this.disposed ? undefined : image);
        } catch (error: unknown) {
          job.reject(error);
        } finally {
          this.pending.delete(job.index);
          this.wanted.delete(job.index);
        }
      }
    } finally {
      this.active = false;
    }
  }
  dispose() {
    this.disposed = true;
    this.cache.clear();
    for (const job of this.queue) job.resolve(undefined);
    this.queue = [];
    this.pending.clear();
    this.wanted.clear();
  }
}
