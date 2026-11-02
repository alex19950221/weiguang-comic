import { useEffect, useState } from 'preact/hooks';
import { Shelf } from '@/pages/Shelf';
import { initializeLibrary } from '@/app/library';
import { t } from '@/i18n';
import { appLock } from '@/app/appLockService';
import { LockScreen } from '@/components/LockScreen';

export default function LibraryApp() {
  const [state, setState] = useState<'opening' | 'ready' | 'error'>('opening');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void initializeLibrary()
      .then(() => {
        if (!cancelled) setState('ready');
      })
      .catch((error: unknown) => {
        console.error('Library database could not be opened', error);
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const lock = appLock();
  const lockState = lock.state.value;
  useEffect(() => {
    if (state === 'ready') void lock.start();
  }, [state, lock]);

  // 读到应用锁设置前不显示书架，避免开启了锁的用户在启动瞬间看到内容。
  if (state === 'ready' && lockState.ready)
    return (
      <>
        <div
          style={{ display: 'contents' }}
          inert={lockState.locked}
          aria-hidden={lockState.locked ? true : undefined}
        >
          <Shelf />
        </div>
        {lockState.locked && <LockScreen lock={lock} />}
      </>
    );
  return (
    <main class="shelf">
      <header class="shelf-header">
        <h1>{t('书架')}</h1>
      </header>
      <section class="shelf-empty" aria-live="polite">
        {state !== 'error' ? (
          <p role="status">{t('正在打开书架…')}</p>
        ) : (
          <>
            <h2>{t('暂时无法读取书架')}</h2>
            <button
              type="button"
              onClick={() => {
                setState('opening');
                setAttempt((value) => value + 1);
              }}
            >
              {t('重试')}
            </button>
          </>
        )}
      </section>
    </main>
  );
}
