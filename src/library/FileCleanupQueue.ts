import type { ComicDatabase } from '@/db/schema';
import type { ComicArchivePlugin } from '@/native/comicArchive';

export class FileCleanupQueue {
  private running: Promise<void> | null = null;
  private requested = false;
  constructor(
    private db: ComicDatabase,
    private native: Pick<ComicArchivePlugin, 'disposeBook'>,
  ) {}
  drain(): Promise<void> {
    this.requested = true;
    if (!this.running)
      this.running = this.run().finally(() => {
        this.running = null;
      });
    return this.running;
  }
  private async run() {
    while (this.requested) {
      this.requested = false;
      const jobs = await this.db.fileCleanup.toArray();
      for (const job of jobs) {
        try {
          // 不向原生传任何用户路径，inplace 只清缓存和书签授权。
          await this.native.disposeBook({
            bookId: job.bookId,
            deleteCopy: job.location === 'copy',
          });
          await this.db.fileCleanup.delete(job.bookId);
        } catch {
          await this.db.fileCleanup.update(job.bookId, {
            state: 'failed',
            attempts: job.attempts + 1,
            error: 'CLEANUP_FAILED',
            updatedAt: Date.now(),
          });
        }
      }
    }
  }
}
