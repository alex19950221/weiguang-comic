import { useState } from 'preact/hooks';
import { useLibrary } from '@/app/libraryServices';
import { proStore } from '@/app/pro';
import { LibraryDialog } from '@/components/LibraryControls';
import { t } from '@/i18n';
import {
  normalizeImageFilters,
  originalFilters,
  ORIGINAL_FILTERS,
  saveImageFilters,
  type ImageFilters,
} from './filters';

export function FilterDialog({
  bookId,
  value,
  onApply,
  onClose,
  onPro,
}: {
  bookId: string;
  value: ImageFilters;
  onApply: (value: ImageFilters) => void;
  onClose: () => void;
  onPro: () => void;
}) {
  const { db } = useLibrary();
  const [draft, setDraft] = useState(() => normalizeImageFilters(value));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pro = proStore().state.value.status === 'pro';
  async function apply(next: ImageFilters) {
    if (busy) return;
    if (!pro && !originalFilters(next)) {
      onPro();
      return;
    }
    setBusy(true);
    setError(false);
    try {
      onApply(await saveImageFilters(db, bookId, next, pro));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <LibraryDialog title={t('画面滤镜')} busy={busy} onClose={onClose}>
      <div class="reading-filters">
        <p>{t('只对这本书生效，应用后查看效果。原文件不会改变。')}</p>
        {!pro && <p>{t('需要微光 Pro，目前按原图显示')}</p>}
        {(
          [
            ['contrast', '对比度', 50, 150],
            ['sharpness', '锐化', 0, 100],
            ['warmth', '暖色', 0, 100],
          ] as const
        ).map(([key, label, min, max]) => (
          <label>
            <span>
              {t(label)} · {draft[key]}%
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={draft[key]}
              disabled={busy}
              aria-label={t(label)}
              onInput={(event) =>
                setDraft({ ...draft, [key]: Number(event.currentTarget.value) })
              }
            />
          </label>
        ))}
        {error && <p role="alert">{t('设置未保存，请重试。')}</p>}
        <div class="reading-filter-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply(draft)}
          >
            {t(pro || originalFilters(draft) ? '应用滤镜' : '解锁微光 Pro')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void apply({ ...ORIGINAL_FILTERS })}
          >
            {t('还原画面（免费）')}
          </button>
          <button type="button" disabled={busy} onClick={onClose}>
            {t('取消')}
          </button>
        </div>
      </div>
    </LibraryDialog>
  );
}
