import type { AppLock } from '@/app/appLock';
import { t } from '@/i18n';
import { Icon } from './Icon';

/** 应用锁屏：盖住整个界面（含阅读器），书架与阅读状态在下面保持不变。 */
export function LockScreen({ lock }: { lock: AppLock }) {
  const state = lock.state.value;
  return (
    <div
      class="app-lock"
      role="dialog"
      aria-modal="true"
      aria-label={t('微光漫卷已锁定')}
    >
      <span class="app-lock-icon">
        <Icon name="lock" size={36} />
      </span>
      <h1>{t('微光漫卷已锁定')}</h1>
      <button
        type="button"
        class="app-lock-button"
        disabled={state.busy}
        onClick={() => void lock.unlock()}
      >
        {t(
          state.busy
            ? '正在验证…'
            : state.biometry === 'faceID'
              ? '用面容 ID 解锁'
              : state.biometry === 'touchID'
                ? '用触控 ID 解锁'
                : '解锁',
        )}
      </button>
      {state.error === 'failed' && (
        <p role="alert">{t('验证未通过，请重试。')}</p>
      )}
    </div>
  );
}
