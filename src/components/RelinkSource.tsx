import { useState } from 'preact/hooks';
import type { Book } from '@/db/models';
import { relinkComic, pickingFiles } from '@/app/library';
import { t } from '@/i18n';

export function RelinkSource({
  book,
  onRelink,
}: {
  book: Book;
  onRelink?: () => void;
}) {
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  if (book.location !== 'inplace') return null;
  async function choose() {
    setError('');
    setNotice(false);
    try {
      if (await relinkComic(book)) {
        setNotice(true);
        onRelink?.();
      }
    } catch (error: unknown) {
      setError(
        t(
          error instanceof Error
            ? error.message
            : '暂时无法导入，请重新选择文件。',
        ),
      );
    }
  }
  return (
    <div class="shelf-source-relink">
      <p>
        {t('原位阅读：只保存访问授权。请保留原文件，并确保它已下载到设备。')}
      </p>
      <button
        type="button"
        disabled={pickingFiles.value}
        onClick={() => void choose()}
      >
        {t('重新选择原文件')}
      </button>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{t('已重新连接，阅读记录已保留。')}</p>}
    </div>
  );
}
