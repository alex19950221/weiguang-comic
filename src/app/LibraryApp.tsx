import { useEffect, useState } from 'preact/hooks';
import { Shelf } from '@/pages/Shelf';
import { initializeLibrary } from '@/app/library';
import { t } from '@/i18n';

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

  if (state === 'ready') return <Shelf />;
  return (
    <main class="shelf">
      <header class="shelf-header">
        <h1>{t('书架')}</h1>
      </header>
      <section class="shelf-empty" aria-live="polite">
        {state === 'opening' ? (
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
