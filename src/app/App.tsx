import { lazy, Suspense } from 'preact/compat';
import { t } from '@/i18n';

const Entry = import.meta.env.VITE_COMIC_PROTOTYPE
  ? lazy(() => import('@/pages/Prototype'))
  : lazy(() => import('@/app/LibraryApp'));

export function App() {
  return (
    <Suspense fallback={<p role="status">{t('正在打开…')}</p>}>
      <Entry />
    </Suspense>
  );
}
