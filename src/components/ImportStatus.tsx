import type { ImportJob, ImportState } from '@/db/models';
import { importError, importProgress, importQueue } from '@/app/library';
import { isImportFinished } from '@/library/ImportQueue';
import { t } from '@/i18n';
import type { ComicDatabase } from '@/db/schema';
import { formatBytes } from './LibraryControls';

const labels: Record<ImportState, string> = {
  queued: '等待导入',
  copying: '正在复制',
  inspecting: '正在检查图片',
  saving: '正在保存',
  done: '已导入',
  duplicate: '书架中已存在，已跳过',
  failed: '导入失败',
  cancelled: '已取消',
};

export function ImportStatus({
  jobs,
  db,
}: {
  jobs: readonly ImportJob[];
  db?: ComicDatabase;
}) {
  if (!jobs.length) return null;
  const visible = jobs.filter((job) => !isImportFinished(job));
  visible.push(...jobs.filter(isImportFinished).slice(0, 8));
  return (
    <section class="import-status" aria-labelledby="import-title">
      <header>
        <h2 id="import-title">{t('导入记录')}</h2>
        {db && (
          <button
            type="button"
            disabled={
              !jobs.some((job) => isImportFinished(job) && !job.cleanupPending)
            }
            onClick={() => {
              void db
                .transaction('rw', db.imports, async () => {
                  const completed = (await db.imports.toArray()).filter(
                    (job) => isImportFinished(job) && !job.cleanupPending,
                  );
                  await db.imports.bulkDelete(completed.map((job) => job.id));
                })
                .catch(() => {
                  importError.value = '操作未完成，请重试。';
                });
            }}
          >
            {t('清除记录')}
          </button>
        )}
      </header>
      <ul class="import-list">
        {visible.map((job) => {
          const progress = importProgress.value[job.id];
          const percent = progress
            ? Math.floor((progress.copied / progress.total) * 100)
            : null;
          const cancellable = !isImportFinished(job) && job.state !== 'saving';
          return (
            <li key={job.id}>
              <div class="import-detail">
                <strong>{job.source.name}</strong>
                <span role="status">
                  {t(labels[job.state])}
                  {job.state === 'copying' && percent !== null
                    ? ` · ${percent}% · ${formatBytes(progress?.copied ?? job.copiedBytes)} / ${formatBytes(progress?.total ?? job.source.size)}`
                    : ''}
                </span>
                {job.state === 'copying' && (
                  <progress
                    aria-label={t('正在复制「{0}」', job.source.name)}
                    max={100}
                    {...(percent === null ? {} : { value: percent })}
                  />
                )}
                {job.error && <p>{t(job.error)}</p>}
                {job.cleanupPending && (
                  <p>{t('未完成的副本将在下次打开时继续清理。')}</p>
                )}
              </div>
              {cancellable && (
                <button
                  type="button"
                  aria-label={t('取消导入「{0}」', job.source.name)}
                  onClick={() => {
                    void importQueue.cancel(job.id).catch(() => {
                      importError.value = '取消未完成，请稍后重试。';
                    });
                  }}
                >
                  {t('取消')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
