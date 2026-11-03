import { useEffect, useRef, useState } from 'preact/hooks';
import { useLibrary } from '@/app/libraryServices';
import { proStore } from '@/app/pro';
import { applyBatch, BatchError, type BatchAction } from '@/library/batch';
import type { LibraryTarget } from '@/library/actions';
import type { LibraryGroup } from '@/db/models';
import { t } from '@/i18n';
import { LibraryDialog } from './LibraryControls';
import { actionError } from './LibraryDialogs';

export interface BatchOption {
  target: LibraryTarget;
  title: string;
  detail: string;
  bookIds: readonly string[];
}
const key = (item: BatchOption) => `${item.target.kind}:${item.target.id}`;

export function BatchDialog({
  items,
  groups,
  onClose,
  onApplied,
  onPro,
}: {
  /** 打开弹窗时的快照；导入新卷不能悄悄扩大已确认的操作范围。 */
  items: readonly BatchOption[];
  groups: readonly LibraryGroup[];
  onClose: () => void;
  onApplied: () => void;
  onPro: () => void;
}) {
  const { db, nativeAvailable } = useLibrary();
  const [selected, setSelected] = useState(new Set<string>());
  const [groupId, setGroupId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmDelete) cancelDelete.current?.focus();
  }, [confirmDelete]);
  const chosen = items.filter((item) => selected.has(key(item)));
  const bookIds = [...new Set(chosen.flatMap((item) => [...item.bookIds]))];
  async function apply(action: BatchAction) {
    if (busy || !bookIds.length) return;
    setBusy(true);
    setError('');
    try {
      await applyBatch(
        db,
        { targets: chosen.map((item) => item.target), bookIds },
        action,
        proStore().state.value.status === 'pro',
      );
      onApplied();
    } catch (error: unknown) {
      if (error instanceof BatchError && error.code === 'PRO_REQUIRED') onPro();
      else
        setError(
          error instanceof BatchError
            ? t('所选书目已经变化，请关闭后重新选择。')
            : actionError(error),
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <LibraryDialog title={t('批量整理')} onClose={onClose} busy={busy}>
      <div class="shelf-batch-summary" role="status">
        {t('已选择 {0} 项，共 {1} 本', chosen.length, bookIds.length)}
      </div>
      {!confirmDelete ? (
        <>
          <div class="shelf-batch-select-all">
            <button
              type="button"
              disabled={busy}
              onClick={() => setSelected(new Set(items.map(key)))}
            >
              {t('全选')}
            </button>
            <button
              type="button"
              disabled={busy || !selected.size}
              onClick={() => setSelected(new Set())}
            >
              {t('取消全选')}
            </button>
          </div>
          <ul class="shelf-batch-items">
            {items.map((item) => (
              <li key={key(item)}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.has(key(item))}
                    disabled={busy}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setSelected((before) => {
                        const next = new Set(before);
                        if (checked) next.add(key(item));
                        else next.delete(key(item));
                        return next;
                      });
                    }}
                  />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div class="shelf-batch-actions">
            <button
              type="button"
              disabled={busy || !bookIds.length}
              onClick={() => void apply({ kind: 'read', finished: true })}
            >
              {t('标记为读完')}
            </button>
            <button
              type="button"
              disabled={busy || !bookIds.length}
              onClick={() => void apply({ kind: 'read', finished: false })}
            >
              {t('标记为未读')}
            </button>
            <label>
              {t('移入分组')}
              <select
                value={groupId}
                disabled={busy}
                onChange={(event) => setGroupId(event.currentTarget.value)}
              >
                <option value="">{t('未分组')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <p>{t('分组按系列生效，所选书籍的同系列卷会一起移动。')}</p>
            <button
              type="button"
              disabled={busy || !bookIds.length}
              onClick={() =>
                void apply({ kind: 'move', groupId: groupId || null })
              }
            >
              {t('移入分组')}
            </button>
            <button
              type="button"
              class="shelf-danger"
              disabled={busy || !bookIds.length || !nativeAvailable}
              onClick={() => setConfirmDelete(true)}
            >
              {t('从书架删除')}
            </button>
          </div>
        </>
      ) : (
        <div class="shelf-delete-confirm" role="alert">
          <p>
            {t(
              '从书架删除所选 {0} 本漫画？App 内副本、阅读位置和书签会清除，原文件不受影响。',
              bookIds.length,
            )}
          </p>
          <ul>
            {chosen.map((item) => (
              <li key={key(item)}>
                {item.title} · {item.detail}
              </li>
            ))}
          </ul>
          <button
            ref={cancelDelete}
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(false)}
          >
            {t('取消')}
          </button>
          <button
            type="button"
            class="shelf-danger"
            disabled={busy || !nativeAvailable}
            onClick={() => void apply({ kind: 'delete' })}
          >
            {t(busy ? '正在删除…' : '删除')}
          </button>
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
