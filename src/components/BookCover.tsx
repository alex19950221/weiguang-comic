import { useEffect, useRef, useState } from 'preact/hooks';
import type { Book } from '@/db/models';
import { useLibrary } from '@/app/libraryServices';
import { localPageUrl } from '@/native/comicArchive';
import { t } from '@/i18n';
import { Icon } from './Icon';
/** 只让进入视口的封面请求原生缩略图；不在 WebView 读压缩包或生成图片。 */
export function BookCover({ book }: { book: Book }) {
  const { db, archive, nativeAvailable } = useLibrary();
  const root = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!visible || !nativeAvailable || book.status !== 'ready') return;
    void (async () => {
      const first = (await db.pageLists.get(book.id))?.pages[0];
      if (!first || cancelled) return;
      const page = await archive.thumbnail({
        bookId: book.id,
        path: book.path,
        entry: first.entry,
      });
      if (!cancelled) setUrl(localPageUrl(page).url);
    })().catch(() => {
      if (!cancelled) setUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    book.id,
    book.path,
    book.status,
    book.sourceUpdatedAt,
    visible,
    db,
    archive,
    nativeAvailable,
  ]);
  return (
    <span ref={root} class="shelf-cover">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setUrl(null)}
        />
      ) : (
        <span class="shelf-cover-placeholder">
          <Icon name="book" size={30} />
          <b>{book.format.toUpperCase()}</b>
          <small>
            {t(book.status === 'missing' ? '文件未找到' : '暂无封面')}
          </small>
        </span>
      )}
    </span>
  );
}
