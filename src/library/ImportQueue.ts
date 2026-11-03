import { epubBook } from '@/archive/epub';
import { pageList, pdfPageList } from '@/archive/pageList';
import { parseComicName } from './series';
import { ensureSeries } from './seriesRepository';
import { canPerform } from '@/app/proPolicy';
import type { PluginListenerHandle } from '@capacitor/core';
import type { Book, ImportJob, ImportSource } from '@/db/models';
import type { ComicDatabase } from '@/db/schema';
import type { ComicArchivePlugin } from '@/native/comicArchive';
import type { ComicImportPlugin, ImportProgress } from '@/native/comicImport';

export const finishedImportStates = [
  'done',
  'duplicate',
  'failed',
  'cancelled',
] as const;
export const isImportFinished = (job: ImportJob) =>
  finishedImportStates.some((state) => state === job.state);

class ImportCancelled extends Error {}
const UNSUPPORTED = '目前支持导入 ZIP、CBZ、PDF 和 EPUB 文件。';

/** 单文件逐个复制与检查；文件、解压和指纹计算始终留在原生层。 */
export class ImportQueue {
  private pending: ImportJob[] = [];
  private running: Promise<void> | null = null;
  private cancelled = new Set<string>();
  private committing = new Set<string>();
  private active: string | null = null;

  constructor(
    private db: ComicDatabase,
    private archive: ComicArchivePlugin,
    private files: ComicImportPlugin,
    private onProgress: (event: ImportProgress) => void = () => undefined,
    private onError: (error: unknown) => void = () => undefined,
  ) {}

  async enqueue(
    sources: readonly ImportSource[],
    location: Book['location'] = 'copy',
    proActive = false,
  ): Promise<void> {
    if (location === 'inplace' && !canPerform('inplace.add', proActive))
      throw new Error('原位添加需要微光 Pro。');
    const now = Date.now();
    const jobs = sources.map((source): ImportJob => ({
      id: crypto.randomUUID(),
      bookId: crypto.randomUUID(),
      source,
      location,
      state: 'queued',
      copiedBytes: 0,
      path: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    }));
    await this.db.transaction('rw', this.db.imports, () =>
      this.db.imports.bulkAdd(jobs),
    );
    this.pending.push(...jobs);
    this.start();
  }

  private start() {
    if (this.running) return;
    this.running = this.drain()
      .catch(this.onError)
      .finally(() => {
        this.running = null;
        if (this.pending.length) this.start();
      });
  }

  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  private async drain() {
    while (this.pending.length) {
      const job = this.pending.shift()!;
      const latest = await this.db.imports.get(job.id);
      if (!latest || isImportFinished(latest)) {
        this.cancelled.delete(job.id);
        continue;
      }
      this.active = job.id;
      let lastCopied = 0;
      let handle: PluginListenerHandle | null = null;
      try {
        handle = await this.files.addListener('progress', (event) => {
          if (
            event.jobId === job.id &&
            job.state === 'copying' &&
            !this.cancelled.has(event.jobId) &&
            Number.isSafeInteger(event.copied) &&
            Number.isSafeInteger(event.total) &&
            event.copied >= lastCopied &&
            event.total > 0 &&
            event.copied <= event.total
          ) {
            lastCopied = event.copied;
            this.onProgress(event);
          }
        });
        await this.process(job);
      } catch (error: unknown) {
        await this.fail(job, error);
      } finally {
        this.active = null;
        this.cancelled.delete(job.id);
        this.committing.delete(job.id);
        await handle?.remove().catch(this.onError);
        await this.files
          .releaseSources({ uris: [job.source.uri] })
          .catch(this.onError);
      }
    }
  }

  async cancel(jobId: string): Promise<void> {
    if (this.committing.has(jobId)) return;
    this.cancelled.add(jobId);
    const job = await this.db.imports.get(jobId);
    if (!job || isImportFinished(job) || this.committing.has(jobId)) {
      this.cancelled.delete(jobId);
      return;
    }
    if (this.active === jobId) {
      await this.files.cancel({ jobId });
    } else {
      await this.patch(job, { state: 'cancelled' });
      await this.files.releaseSources({ uris: [job.source.uri] });
    }
  }

  /** 临时选择授权不跨进程保存；重开后保留已入库书籍，未完成任务要求重新选择。 */
  async recover(): Promise<void> {
    const jobs = await this.db.imports.toArray();
    for (const job of jobs) {
      if (isImportFinished(job) && !job.cleanupPending) continue;
      if (await this.db.books.get(job.bookId)) {
        await this.patch(job, {
          state: 'done',
          error: null,
          cleanupPending: false,
        });
        continue;
      }
      const cleaned = await this.cleanup(job);
      await this.patch(job, {
        state: isImportFinished(job) ? job.state : 'failed',
        error: isImportFinished(job)
          ? job.error
          : '上次导入已中断，请重新选择文件。',
        path: cleaned ? null : job.path,
        cleanupPending: !cleaned,
      });
    }
  }

  private checkCancelled(job: ImportJob) {
    if (this.cancelled.has(job.id)) throw new ImportCancelled();
  }

  private async patch(job: ImportJob, patch: Partial<ImportJob>) {
    const updated = { ...patch, updatedAt: Date.now() };
    await this.db.imports.update(job.id, updated);
    Object.assign(job, updated);
  }

  private async cleanup(job: ImportJob): Promise<boolean> {
    try {
      await this.archive.clearCache({ bookId: job.bookId });
      await this.files.removeCopy({ bookId: job.bookId });
      return true;
    } catch {
      return false;
    }
  }

  private async process(job: ImportJob) {
    try {
      this.checkCancelled(job);
      if (
        job.source.isDirectory ||
        !/\.(zip|cbz|pdf|epub)$/i.test(job.source.name)
      )
        throw new Error(UNSUPPORTED);
      const inplace = job.location === 'inplace';
      await this.patch(job, { state: inplace ? 'inspecting' : 'copying' });
      this.checkCancelled(job);
      const copy = inplace
        ? await this.files.linkToLibrary({
            bookId: job.bookId,
            item: job.source,
          })
        : await this.files.copyToLibrary({
            jobId: job.id,
            bookId: job.bookId,
            item: job.source,
          });
      if (!copy.path || !Number.isSafeInteger(copy.size) || copy.size <= 0)
        throw new Error('复制结果无效，请重新选择文件。');
      await this.patch(job, {
        path: copy.path,
        copiedBytes: copy.size,
        state: 'inspecting',
      });
      this.checkCancelled(job);
      const fingerprint = await this.archive.fingerprint({ path: copy.path });
      if (
        !/^[a-f0-9]{64}$/i.test(fingerprint.sha256) ||
        fingerprint.size !== copy.size
      )
        throw new Error('文件校验失败，请重新选择文件。');
      const contentId = fingerprint.sha256.toLowerCase();
      this.checkCancelled(job);
      const inspection = await this.archive.inspect({ path: copy.path });
      const format = inspection.format;
      if (format !== 'zip' && format !== 'pdf' && format !== 'epub')
        throw new Error(UNSUPPORTED);
      const epub = format === 'epub' ? epubBook(inspection) : null;
      if (inspection.encrypted || epub?.protectedContent)
        throw new Error(
          format === 'pdf'
            ? '暂不支持需要密码的 PDF，请选择未加密的自有文件。'
            : epub
              ? '暂不支持加密或受版权保护的 EPUB，请选择未加密的自有文件。'
              : '暂不支持加密压缩包，请选择未加密的自有文件。',
        );
      if (epub?.textHeavy && !epub.pages.length)
        throw new Error('这本 EPUB 以文字为主，目前只支持图片漫画 EPUB。');
      const pages = epub
        ? epub.pages
        : format === 'pdf'
          ? pdfPageList(inspection.entries)
          : pageList(inspection.entries);
      if (!pages.length)
        throw new Error(
          format === 'pdf'
            ? 'PDF 中没有可读取的页面。'
            : epub
              ? 'EPUB 中没有可读取的漫画图片。'
              : '压缩包中没有可读取的图片。',
        );
      this.checkCancelled(job);
      // 此后原子提交，取消不能把已入库文件作为临时副本清理。
      this.committing.add(job.id);
      await this.patch(job, { state: 'saving' });
      const importedAt = Date.now();
      await this.db.transaction(
        'rw',
        [this.db.books, this.db.series, this.db.pageLists, this.db.imports],
        async () => {
          const existing = await this.db.books
            .where('fingerprint')
            .equals(contentId)
            .first();
          if (existing) {
            await this.db.imports.update(job.id, {
              state: 'duplicate',
              cleanupPending: true,
              updatedAt: importedAt,
            });
            return;
          }
          const parsed = parseComicName(job.source.name);
          const series = await ensureSeries(
            this.db,
            parsed.title,
            job.bookId,
            importedAt,
          );
          const book: Book = {
            id: job.bookId,
            fingerprint: contentId,
            title: parsed.title,
            fileName: job.source.name,
            unit: parsed.unit,
            seriesId: series.id,
            volume: parsed.unit === '卷' ? parsed.volume : null,
            chapter: parsed.unit === '话' ? parsed.volume : null,
            sortKey: parsed.title.normalize('NFC').toLowerCase(),
            format,
            location: inplace ? 'inplace' : 'copy',
            path: copy.path,
            sizeBytes: copy.size,
            pageCount: pages.length,
            coverPage: 0,
            nameEncoding: inspection.entries.some((entry) => entry.rawName)
              ? 'gb18030'
              : 'utf-8',
            direction: inspection.manga === 'rtl' || epub?.rtl ? 'rtl' : null,
            mode: null,
            spreadOffset: 0,
            cropBorders: false,
            status: 'ready',
            importedAt,
            lastReadAt: null,
            meta: null,
          };
          await this.db.books.add(book);
          await this.db.pageLists.add({
            bookId: book.id,
            pages,
            updatedAt: importedAt,
          });
          await this.db.imports.update(job.id, {
            state: 'done',
            error: null,
            cleanupPending: false,
            updatedAt: importedAt,
          });
        },
      );
      const saved = await this.db.imports.get(job.id);
      if (saved?.state === 'duplicate') {
        Object.assign(job, saved);
        const cleaned = await this.cleanup(job);
        await this.patch(job, {
          path: cleaned ? null : job.path,
          cleanupPending: !cleaned,
        });
      }
    } catch (error: unknown) {
      await this.fail(job, error);
    }
  }

  private async fail(job: ImportJob, error: unknown) {
    // 数据库成功提交后即使后续清理出错，也不能删除已有书籍。
    if (await this.db.books.get(job.bookId)) return;
    const cleaned = await this.cleanup(job);
    await this.patch(job, {
      state:
        this.cancelled.has(job.id) || error instanceof ImportCancelled
          ? 'cancelled'
          : 'failed',
      error:
        this.cancelled.has(job.id) || error instanceof ImportCancelled
          ? null
          : error instanceof Error
            ? error.message
            : '导入失败，请重新选择文件。',
      path: cleaned ? null : job.path,
      cleanupPending: !cleaned,
    });
  }
}
