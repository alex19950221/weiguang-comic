import { useRef, useEffect, useState } from 'preact/hooks';
import type { LibraryGroup, Progress } from '@/db/models';
import type { ShelfEntry } from '@/library/shelf';
import { bookState } from '@/library/shelf';
import {
  GroupError,
  createLibraryGroup,
  renameLibraryGroup,
  deleteLibraryGroup,
  moveSeriesToGroup,
} from '@/library/groups';
import {
  markTargetRead,
  deleteLibraryTarget,
  type LibraryTarget,
} from '@/library/actions';
import type { FileCleanupQueue } from '@/library/FileCleanupQueue';
import { useLibrary } from '@/app/libraryServices';
import { t } from '@/i18n';
import { BookCover } from './BookCover';
import { LibraryDialog, formatBytes } from './LibraryControls';
import { volumeLabel } from './ShelfCards';

const groupMessages: Record<GroupError['code'], string> = {
  GROUP_NAME_REQUIRED: '请输入分组名称',
  GROUP_NAME_TOO_LONG: '分组名称最多 20 个字',
  GROUP_NAME_EXISTS: '这个分组名称已存在',
  GROUP_NOT_FOUND: '分组已不存在，请重新选择',
  SERIES_NOT_FOUND: '系列已不存在，请返回书架',
};
export const actionError = (error: unknown) =>
  t(
    error instanceof GroupError
      ? groupMessages[error.code]
      : '操作未完成，请重试。',
  );
export function GroupSelect({
  seriesId,
  groupId,
  groups,
  onNew,
  onError,
  disabled = false,
}: {
  seriesId: string;
  groupId: string | null;
  groups: readonly LibraryGroup[];
  onNew: (seriesId: string) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const { db } = useLibrary();
  return (
    <label class="shelf-group-move">
      <span>{t('所在分组')}</span>
      <select
        aria-label={t('所在分组')}
        value={groupId ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const value = event.currentTarget.value;
          event.currentTarget.value = groupId ?? '';
          if (value === '__new') onNew(seriesId);
          else
            void moveSeriesToGroup(db, seriesId, value || null).catch((error) =>
              onError(actionError(error)),
            );
        }}
      >
        <option value="">{t('未分组')}</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
        <option value="__new">{t('新建分组…')}</option>
      </select>
    </label>
  );
}
export type GroupEditor =
  { kind: 'create'; seriesId?: string } | { kind: 'edit'; group: LibraryGroup };
export function GroupDialog({
  editor,
  onClose,
  onCreated,
}: {
  editor: GroupEditor;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { db } = useLibrary();
  const [name, setName] = useState(
    editor.kind === 'edit' ? editor.group.name : '',
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  async function save(remove = false) {
    setBusy(true);
    setError('');
    try {
      if (editor.kind === 'edit') {
        if (remove) await deleteLibraryGroup(db, editor.group.id);
        else await renameLibraryGroup(db, editor.group.id, name);
        onClose();
      } else {
        const group = await createLibraryGroup(db, name);
        if (editor.seriesId)
          await moveSeriesToGroup(db, editor.seriesId, group.id);
        onCreated(group.id);
      }
    } catch (error: unknown) {
      setError(actionError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LibraryDialog
      title={t(editor.kind === 'create' ? '新建分组' : '管理分组')}
      onClose={onClose}
      busy={busy}
    >
      <form
        class="shelf-group-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label>
          {t('分组名称')}
          <input
            ref={input}
            value={name}
            maxLength={20}
            onInput={(event) => setName(event.currentTarget.value)}
            disabled={busy}
          />
        </label>
        <button class="shelf-primary" disabled={busy || !name.trim()}>
          {t(busy ? '正在保存' : '保存')}
        </button>
      </form>
      {editor.kind === 'edit' && (
        <div class="shelf-delete-confirm">
          {confirm ? (
            <>
              <p>
                {t(
                  '删除分组后，其中的系列会移回未分组，书籍和阅读记录会保留。',
                )}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                {t('取消')}
              </button>
              <button
                type="button"
                class="shelf-danger"
                disabled={busy}
                onClick={() => void save(true)}
              >
                {t('删除分组')}
              </button>
            </>
          ) : (
            <button
              type="button"
              class="shelf-danger-text"
              onClick={() => setConfirm(true)}
            >
              {t('删除分组')}
            </button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" class="shelf-error">
          {error}
        </p>
      )}
    </LibraryDialog>
  );
}
export function ManageDialog({
  target,
  entries,
  progress,
  groups,
  cleanup,
  onClose,
  onNewGroup,
  onRead,
}: {
  target: LibraryTarget;
  entries: readonly ShelfEntry[];
  progress: ReadonlyMap<string, Progress>;
  groups: readonly LibraryGroup[];
  cleanup: FileCleanupQueue;
  onClose: () => void;
  onNewGroup: (seriesId: string) => void;
  onRead: (bookId: string) => void;
}) {
  const { db, nativeAvailable } = useLibrary();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const entry = entries.find((item) =>
    target.kind === 'series'
      ? item.series.id === target.id
      : item.books.some((book) => book.id === target.id),
  );
  const book =
    target.kind === 'book'
      ? entry?.books.find((book) => book.id === target.id)
      : entry?.current;
  useEffect(() => {
    if (!entry || !book) onClose();
  }, [entry, book, onClose]);
  if (!entry || !book) return null;
  const books = target.kind === 'series' ? entry.books : [book];
  const allRead = books.every(
    (book) => bookState(book, progress) === 'finished',
  );
  const size = books.reduce((sum, book) => sum + book.sizeBytes, 0);
  const page = progress.get(book.id)?.page;
  async function act(remove = false) {
    setBusy(true);
    setError('');
    try {
      if (remove) {
        await deleteLibraryTarget(db, target);
        await cleanup.drain();
        onClose();
      } else await markTargetRead(db, target, !allRead);
    } catch (error: unknown) {
      setError(actionError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <LibraryDialog
      title={t(target.kind === 'series' ? '管理系列' : '这本漫画')}
      onClose={onClose}
      busy={busy}
    >
      <div class="shelf-book-details">
        <BookCover book={book} />
        <div>
          <h3>{entry.series.title}</h3>
          <p>
            {target.kind === 'series'
              ? t('共 {0} 本', books.length)
              : volumeLabel(book)}
          </p>
          <dl>
            {target.kind === 'book' && (
              <div class="shelf-file">
                <dt>{t('文件')}</dt>
                <dd>{book.fileName ?? t('原文件名未记录')}</dd>
              </div>
            )}
            <div>
              <dt>{t('格式')}</dt>
              <dd>
                {[
                  ...new Set(books.map((book) => book.format.toUpperCase())),
                ].join(' / ')}
              </dd>
            </div>
            <div>
              <dt>{t('大小')}</dt>
              <dd>{formatBytes(size)}</dd>
            </div>
            <div>
              <dt>{t('页数')}</dt>
              <dd>
                {t(
                  '{0} 页',
                  books.reduce((sum, book) => sum + book.pageCount, 0),
                )}
              </dd>
            </div>
            {target.kind === 'book' && (
              <div>
                <dt>{t('进度')}</dt>
                <dd>
                  {page === undefined
                    ? t('未读')
                    : t('第 {0} / {1} 页', page + 1, book.pageCount)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <GroupSelect
        seriesId={entry.series.id}
        groupId={entry.series.groupId}
        groups={groups}
        onNew={onNewGroup}
        onError={setError}
        disabled={busy}
      />
      {confirm ? (
        <div class="shelf-delete-confirm" role="alert">
          <p>
            {t(
              '从书架删除《{0}》（{1}）？App 内副本、阅读位置和书签会一并清除，你的原文件不受影响。',
              entry.series.title,
              formatBytes(size),
            )}
          </p>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              {t('取消')}
            </button>
            <button
              type="button"
              class="shelf-danger"
              disabled={busy || !nativeAvailable}
              onClick={() => void act(true)}
            >
              {t(busy ? '正在删除…' : '删除')}
            </button>
          </div>
        </div>
      ) : (
        <div class="shelf-manage-actions">
          {target.kind === 'book' && (
            <button
              type="button"
              class="shelf-primary"
              disabled={busy}
              onClick={() => onRead(book.id)}
            >
              {t(page === undefined ? '开始阅读' : '继续阅读')}
            </button>
          )}
          <button
            type="button"
            class="shelf-primary"
            disabled={busy}
            onClick={() => void act()}
          >
            {t(
              allRead
                ? '标记为未读'
                : target.kind === 'series'
                  ? '全部标记为读完'
                  : '标记为读完',
            )}
          </button>
          <button
            type="button"
            class="shelf-danger-text"
            disabled={busy || !nativeAvailable}
            onClick={() => setConfirm(true)}
          >
            {t(target.kind === 'series' ? '删除整个系列' : '从书架删除')}
          </button>
        </div>
      )}
      {!nativeAvailable && (
        <p class="shelf-muted">{t('请在移动端 App 中删除副本。')}</p>
      )}
      {error && (
        <p role="alert" class="shelf-error">
          {error}
        </p>
      )}
    </LibraryDialog>
  );
}
