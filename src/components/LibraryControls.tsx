import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { t } from '@/i18n';
import { Icon, type IconName } from './Icon';
import { useAndroidBack } from '@/native/androidBack';
export function IconButton({
  icon,
  label,
  active,
  onClick,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class={`shelf-icon ${active ? 'selected' : ''}`}
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}
export function LibraryDialog({
  title,
  onClose,
  children,
  busy = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useAndroidBack(() => {
    if (!busy) onClose();
    return true;
  }, 100);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      class={`library-dialog ${wide ? 'is-wide' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section class="library-dialog-body">
        <header>
          <h2>{title}</h2>
          <IconButton
            icon="close"
            label={t('关闭弹窗')}
            disabled={busy}
            onClick={onClose}
          />
        </header>
        {children}
      </section>
    </dialog>
  );
}
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
