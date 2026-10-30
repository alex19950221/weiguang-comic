import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Book } from '@/db/models';
import type { ComicPage } from '@/archive/pageList';
import { useLibrary } from '@/app/libraryServices';
import { localPageUrl } from '@/native/comicArchive';
import { LibraryDialog } from '@/components/LibraryControls';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import {
  contentsSections,
  contentsRange,
  CONTENTS_PAGE_SIZE,
} from './contents';
import { ThumbnailLoader } from './ThumbnailLoader';
import type { useBookmarks } from './useBookmarks';
import type { ReadingPosition } from './layout';

export function ReaderContents({
  book,
  pages,
  page,
  visible,
  bookmarks,
  onClose,
  onPick,
  initialTab = 'pages',
}: {
  book: Book;
  pages: readonly ComicPage[];
  page: number;
  visible: readonly number[];
  bookmarks: ReturnType<typeof useBookmarks>;
  onClose: () => void;
  onPick: (position: ReadingPosition) => void;
  initialTab?: 'pages' | 'bookmarks';
}) {
  const { archive, nativeAvailable } = useLibrary();
  const [tab, setTab] = useState(initialTab),
    [rangePage, setRangePage] = useState(page);
  const [targetPage, setTargetPage] = useState(String(page + 1));
  const sections = useMemo(() => contentsSections(pages), [pages]);
  const range = contentsRange(rangePage, pages.length);
  const loader = useMemo(
    () =>
      new ThumbnailLoader(book, pages, async (options) =>
        localPageUrl(await archive.thumbnail(options)),
      ),
    [book, pages, archive],
  );
  useEffect(() => () => loader.dispose(), [loader]);
  const pick = (position: ReadingPosition) => {
    onPick(position);
    onClose();
  };
  return (
    <LibraryDialog
      title={book.title}
      wide
      busy={bookmarks.busy}
      onClose={onClose}
    >
      <div class="reading-contents">
        <div
          class="reading-contents-tabs"
          role="group"
          aria-label={t('目录与书签')}
        >
          <button
            type="button"
            aria-pressed={tab === 'pages'}
            onClick={() => setTab('pages')}
          >
            {t(sections.length ? '章节目录' : '全部页面')}
          </button>
          <button
            type="button"
            aria-pressed={tab === 'bookmarks'}
            onClick={() => setTab('bookmarks')}
          >
            {t('我的书签')} {bookmarks.marks.length}
          </button>
        </div>
        {bookmarks.error && (
          <p role="alert">
            {t('书签操作未保存，请重试。')}{' '}
            <button
              type="button"
              disabled={bookmarks.busy}
              onClick={() => void bookmarks.retryMutation()}
            >
              {t('重试书签操作')}
            </button>
          </p>
        )}
        {tab === 'pages' ? (
          <>
            <form
              class="reading-page-jump"
              onSubmit={(event) => {
                event.preventDefault();
                const target = Number(targetPage) - 1;
                if (
                  Number.isInteger(target) &&
                  target >= 0 &&
                  target < pages.length
                )
                  pick({ page: target, offset: 0 });
              }}
            >
              <label>
                {t('跳到页码')}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={pages.length}
                  step={1}
                  required
                  value={targetPage}
                  aria-label={t('跳到页码')}
                  onInput={(event) => setTargetPage(event.currentTarget.value)}
                />
              </label>
              <button type="submit">{t('跳页')}</button>
            </form>
            {!!sections.length && (
              <nav class="reading-chapters" aria-label={t('章节目录')}>
                {sections.map((section) => (
                  <button
                    type="button"
                    key={section.start}
                    aria-current={
                      page >= section.start && page <= section.end
                        ? 'location'
                        : undefined
                    }
                    onClick={() => pick({ page: section.start, offset: 0 })}
                  >
                    <strong>{section.path || t('未分章页面')}</strong>
                    <small>
                      {t('第 {0}–{1} 页', section.start + 1, section.end + 1)}
                    </small>
                  </button>
                ))}
              </nav>
            )}
            <div class="reading-contents-pager">
              <button
                type="button"
                disabled={range.start === 0}
                onClick={() => setRangePage(range.start - CONTENTS_PAGE_SIZE)}
              >
                {t('上一组页面')}
              </button>
              <span>
                {t(
                  '第 {0}–{1} / {2} 页',
                  range.start + 1,
                  range.end,
                  pages.length,
                )}
              </span>
              <button
                type="button"
                disabled={range.end >= pages.length}
                onClick={() => setRangePage(range.end)}
              >
                {t('下一组页面')}
              </button>
            </div>
            <div class="reading-thumbnails">
              {pages.slice(range.start, range.end).map((item, index) => {
                const target = range.start + index;
                return (
                  <button
                    type="button"
                    key={target}
                    aria-label={t('跳到第 {0} 页', target + 1)}
                    aria-current={visible.includes(target) ? 'page' : undefined}
                    onClick={() => pick({ page: target, offset: 0 })}
                  >
                    <PageThumbnail
                      index={target}
                      loader={loader}
                      available={nativeAvailable}
                    />
                    <strong>{t('第 {0} 页', target + 1)}</strong>
                    <small title={item.name}>
                      {item.name.split('/').at(-1)}
                    </small>
                  </button>
                );
              })}
            </div>
          </>
        ) : bookmarks.state === 'loading' ? (
          <p role="status">{t('正在读取书签…')}</p>
        ) : bookmarks.state === 'error' ? (
          <div role="alert">
            <p>{t('书签暂时无法读取，请重试。')}</p>
            <button type="button" onClick={bookmarks.retry}>
              {t('重试')}
            </button>
          </div>
        ) : bookmarks.marks.length ? (
          <div class="reading-bookmark-list">
            {bookmarks.marks.map((mark) => (
              <div key={mark.id}>
                <button
                  type="button"
                  onClick={() => pick({ page: mark.page, offset: mark.offset })}
                >
                  <PageThumbnail
                    index={mark.page}
                    loader={loader}
                    available={nativeAvailable}
                  />
                  <span>
                    <strong>{t('第 {0} 页', mark.page + 1)}</strong>
                    {mark.offset > 0 && (
                      <small>
                        {t('页内 {0}%', Math.round(mark.offset * 100))}
                      </small>
                    )}
                    {mark.note && <small>{mark.note}</small>}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={bookmarks.busy}
                  aria-label={t('移除第 {0} 页书签', mark.page + 1)}
                  onClick={() => void bookmarks.remove(mark.id)}
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div class="reading-contents-empty">
            <Icon name="bookmark" size={30} />
            <h3>{t('还没有书签')}</h3>
            <p>{t('阅读时点右上角的书签图标，或按 B 键。')}</p>
          </div>
        )}
      </div>
    </LibraryDialog>
  );
}

function PageThumbnail({
  index,
  loader,
  available,
}: {
  index: number;
  loader: ThumbnailLoader;
  available: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null),
    wanted = useRef(false);
  const [visible, setVisible] = useState(false),
    [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        wanted.current = entries.some((entry) => entry.isIntersecting);
        setVisible(wanted.current);
      },
      { root: node.closest('dialog'), rootMargin: '80px' },
    );
    observer.observe(node);
    return () => {
      wanted.current = false;
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (visible && available)
      void loader
        .load(index, () => wanted.current)
        .then((image) => {
          if (!cancelled && image) setUrl(image.url);
        })
        .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [visible, available, index, loader]);
  return (
    <span ref={root} class="reading-thumbnail">
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setUrl(null)}
        />
      ) : (
        <span>
          <Icon name="book" />
          <small>{t('暂无缩略图')}</small>
        </span>
      )}
    </span>
  );
}
