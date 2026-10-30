import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addLocalImages,
  demoState,
  notify,
  preference,
  restoreRemoved,
  setSample,
  simulateImport,
} from '@/app/demo';
import type { DemoPreferences, DemoSample } from '@/app/demo';
import { DemoIcon } from './DemoIcon';
import type { DemoIconName } from './DemoIcon';

export function IconButton({
  icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: DemoIconName;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      class={`demo-icon-button ${active ? 'is-active' : ''}`}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      <DemoIcon name={icon} />
    </button>
  );
}

export function DemoDialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ComponentChildren;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      class={`demo-dialog ${wide ? 'is-wide' : ''}`}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section class="dialog-surface">
        <header class="dialog-heading">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <IconButton icon="close" label="关闭弹窗" onClick={onClose} />
        </header>
        {children}
      </section>
    </dialog>
  );
}

function Segment<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset class="demo-option">
      <legend>{label}</legend>
      <div class="demo-segments">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            class={value === option.value ? 'selected' : ''}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function DemoPreferencesPanel({ reader = false }: { reader?: boolean }) {
  const prefs = demoState.value.preferences;
  return (
    <div class="demo-preferences">
      {!reader && (
        <Segment<DemoPreferences['theme']>
          label="界面外观"
          value={prefs.theme}
          options={[
            { value: 'system', label: '跟随系统' },
            { value: 'paper', label: '暖纸色' },
            { value: 'night', label: '深夜色' },
          ]}
          onChange={(theme) => preference({ theme })}
        />
      )}
      <Segment<DemoPreferences['mode']>
        label={reader ? '阅读方式' : '默认阅读方式'}
        value={prefs.mode}
        options={[
          { value: 'paged', label: '单页翻阅' },
          { value: 'scroll', label: '纵向条漫' },
          { value: 'spread', label: '双页展开' },
        ]}
        onChange={(mode) => preference({ mode })}
      />
      <Segment<DemoPreferences['direction']>
        label="翻页方向"
        value={prefs.direction}
        options={[
          { value: 'ltr', label: '从左向右' },
          { value: 'rtl', label: '从右向左' },
        ]}
        onChange={(direction) => preference({ direction })}
      />
      <Segment<DemoPreferences['spreadCover']>
        label="双页时的封面"
        value={prefs.spreadCover}
        options={[
          { value: 'alone', label: '单独一页' },
          { value: 'paired', label: '与第 2 页拼合' },
        ]}
        onChange={(spreadCover) => preference({ spreadCover })}
      />
      <Segment<DemoPreferences['fit']>
        label="页面适应"
        value={prefs.fit}
        options={[
          { value: 'page', label: '完整显示' },
          { value: 'width', label: '适应宽度' },
        ]}
        onChange={(fit) => preference({ fit })}
      />
      <fieldset class="demo-option">
        <legend>阅读背景</legend>
        <div class="background-options">
          {(
            [
              { value: 'paper', name: '暖纸' },
              { value: 'white', name: '纯白' },
              { value: 'dark', name: '深色' },
            ] as const
          ).map((option) => (
            <button
              type="button"
              aria-pressed={prefs.background === option.value}
              class={`background-swatch swatch-${option.value} ${prefs.background === option.value ? 'selected' : ''}`}
              onClick={() => preference({ background: option.value })}
            >
              <span>{option.name}</span>
              {prefs.background === option.value && (
                <DemoIcon name="check" size={15} />
              )}
            </button>
          ))}
        </div>
      </fieldset>
      <label class="brightness-label">
        <span>
          <DemoIcon name="sun" size={18} />
          阅读亮度 <b>{prefs.brightness}%</b>
        </span>
        <input
          aria-label="阅读亮度"
          type="range"
          min="30"
          max="100"
          value={prefs.brightness}
          onInput={(event) =>
            preference({ brightness: Number(event.currentTarget.value) })
          }
        />
      </label>
      <label class="demo-toggle-row">
        <span>
          <strong>记住阅读位置</strong>
          <small>下次打开，从上次停下的地方继续</small>
        </span>
        <input
          type="checkbox"
          checked={prefs.remember}
          onChange={(event) =>
            preference({ remember: event.currentTarget.checked })
          }
        />
        <i aria-hidden="true" />
      </label>
      {!reader && (
        <>
          <Segment<DemoSample>
            label="原型书架样本"
            value={demoState.value.sample}
            options={[
              { value: 'curated', label: '精选 8 本' },
              { value: 'realistic', label: '真实文件名 60 本' },
              { value: 'empty', label: '首次打开' },
            ]}
            onChange={setSample}
          />
          {demoState.value.removed.length > 0 && (
            <button
              type="button"
              class="demo-secondary"
              onClick={restoreRemoved}
            >
              恢复已删除的 {demoState.value.removed.length} 本演示书目
            </button>
          )}
        </>
      )}
      {!reader && (
        <div class="settings-offline">
          <DemoIcon name="leaf" />
          <div>
            <strong>数据只在这台设备上</strong>
            <p>不需要账号，没有广告，不联网。</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function DemoImportDialog({ onClose }: { onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  async function take(files: readonly File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError('');
    try {
      await addLocalImages(files);
      notify('图片画册已添加到书架');
      onClose();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '图片添加失败，请再试一次',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <DemoDialog
      title="导入漫画"
      subtitle="在浏览器里用图片或模拟压缩包体验导入。"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = '';
          void take(files);
        }}
      />
      <button
        class={`import-dropzone ${dragging ? 'is-dragging' : ''}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void take([...(event.dataTransfer?.files ?? [])]);
        }}
      >
        <span class="import-icon">
          <DemoIcon name="upload" size={28} />
        </span>
        <strong>{busy ? '正在整理图片…' : '点击选择，或把图片拖到这里'}</strong>
        <small>JPG / PNG / WebP · 最多 12 张，每张 8 MB 以内</small>
      </button>
      <p class="import-local-note">
        <DemoIcon name="leaf" size={15} />
        图片只在本地处理，本次预览添加的图片刷新后移除。
      </p>
      <div class="import-divider">
        <span>原型演示</span>
      </div>
      <button
        class="demo-sample-import"
        disabled={busy}
        onClick={() => {
          simulateImport();
          onClose();
        }}
      >
        <span class="sample-import-art">
          <DemoIcon name="upload" size={25} />
        </span>
        <span>
          <strong>模拟导入 3 个压缩包</strong>
          <small>看看复制进度、重复跳过和失败提示</small>
        </span>
        <DemoIcon name="arrow" />
      </button>
      {error && (
        <p class="demo-form-error" role="alert">
          {error}
        </p>
      )}
      <p class="prototype-note">
        正式 App 从“文件”中选择 CBZ / ZIP 或图片文件夹，复制一份到 App
        内，不改动原文件。
      </p>
    </DemoDialog>
  );
}
