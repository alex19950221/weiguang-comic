import { useEffect } from 'preact/hooks';
import { proStore } from '@/app/pro';
import { proFeatures, purchaseOpen } from '@/app/proPolicy';
import { t } from '@/i18n';
import { Icon } from './Icon';
import { LibraryDialog } from './LibraryControls';

/** 只在用户主动打开时显示：不弹窗、不倒计时；只列已交付的功能，其余写明后续免费获得。 */
export function ProDialog({ onClose }: { onClose: () => void }) {
  const store = proStore();
  const state = store.state.value;
  useEffect(() => {
    void store.refresh(true);
  }, [store]);
  const delivered = proFeatures.filter((feature) => feature.delivered);
  const upcoming = proFeatures.filter((feature) => !feature.delivered);
  const open = purchaseOpen();
  // 开放购买前只在开发与 TestFlight 沙盒里允许购买，用于测试流程。
  const testing =
    state.environment === 'development' || state.environment === 'sandbox';
  const canBuy = state.status === 'free' && (open || testing);
  const notice =
    state.notice === 'purchased'
      ? '已解锁微光 Pro，谢谢支持！'
      : state.notice === 'restored'
        ? '已恢复购买。'
        : state.notice === 'nothing-to-restore'
          ? '没有找到这个 Apple 账户的 Pro 购买记录。'
          : state.notice === 'pending'
            ? '购买正在等待批准，批准后会自动解锁。'
            : '';
  return (
    <LibraryDialog
      title={t('微光 Pro')}
      onClose={onClose}
      busy={state.busy !== null}
    >
      <div class="pro-panel">
        <p class="pro-lead">
          {t('一次买断，后续更新免费获得。不订阅、无广告，阅读功能永久免费。')}
        </p>
        {state.status === 'pro' && (
          <p class="pro-owned" role="status">
            <Icon name="check" size={18} />
            {t('已解锁微光 Pro')}
          </p>
        )}
        {delivered.length > 0 && (
          <section>
            <h3>{t('已包含')}</h3>
            <ul class="pro-features">
              {delivered.map((feature) => (
                <li key={feature.id}>
                  <b>{t(feature.name)}</b>
                  <span>{t(feature.description)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3>{t('后续更新，买断用户免费获得')}</h3>
          <ul class="pro-features is-upcoming">
            {upcoming.map((feature) => (
              <li key={feature.id}>
                <b>{t(feature.name)}</b>
                <span>{t(feature.description)}</span>
              </li>
            ))}
          </ul>
        </section>
        {!open && (
          <p class="shelf-muted">
            {t('Pro 功能正在开发，至少两项完成后开放购买。')}
          </p>
        )}
        {state.status === 'unavailable' ? (
          <p class="shelf-muted">{t('当前环境不支持购买。')}</p>
        ) : (
          <div class="pro-actions">
            {canBuy && (
              <button
                type="button"
                class="shelf-primary"
                disabled={state.busy !== null}
                onClick={() => void store.purchase()}
              >
                {state.busy === 'purchase'
                  ? t('正在购买…')
                  : state.price
                    ? t('一次买断 {0}', state.price)
                    : t('一次买断')}
                {!open && testing ? ` · ${t('测试环境')}` : ''}
              </button>
            )}
            <button
              type="button"
              disabled={state.busy !== null || state.status === 'unknown'}
              onClick={() => void store.restore()}
            >
              {state.busy === 'restore' ? t('正在恢复…') : t('恢复购买')}
            </button>
          </div>
        )}
        {notice && (
          <p role="status" class="pro-notice">
            {t(notice)}
          </p>
        )}
        {state.error && (
          <p role="alert" class="shelf-error">
            {t(state.error)}
          </p>
        )}
        <p class="shelf-muted">
          {t(
            '支持家人共享。退款或换到未购买的设备后，书架、进度和书签照常可用。',
          )}
        </p>
      </div>
    </LibraryDialog>
  );
}
