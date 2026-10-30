import type { Book, Progress } from '@/db/models';
import type { ShelfEntry } from '@/library/shelf';
import { bookPercent, bookState } from '@/library/shelf';
import type { LibraryTarget } from '@/library/actions';
import { t } from '@/i18n';
import { BookCover } from './BookCover';
import { IconButton, formatBytes } from './LibraryControls';

export function volumeLabel(book: Book): string {
  const number = book.unit === '话' ? book.chapter : book.volume;
  return number === null
    ? t('单本')
    : t(book.unit === '话' ? '第 {0} 话' : '第 {0} 卷', number);
}
export function entryMeta(entry: ShelfEntry): string {
  if (entry.books.length === 1)
    return `${volumeLabel(entry.current)} · ${t('{0} 页', entry.current.pageCount)} · ${entry.current.format.toUpperCase()}`;
  const units = new Set(entry.books.map((book) => book.unit));
  return `${t(units.size === 1 ? (entry.current.unit === '话' ? '共 {0} 话' : '共 {0} 卷') : '共 {0} 本', entry.books.length)} · ${t('已读完 {0}', entry.finished)}`;
}
export function ShelfCard({
  entry,
  progress,
  onOpen,
  onManage,
  onFavorite,
}: {
  entry: ShelfEntry;
  progress: ReadonlyMap<string, Progress>;
  onOpen: () => void;
  onManage: (target: LibraryTarget) => void;
  onFavorite: () => void;
}) {
  const multi = entry.books.length > 1;
  const status =
    entry.state === 'finished'
      ? t(multi ? '全部读完' : '已读完')
      : entry.state === 'reading'
        ? multi
          ? t('读到{0}', volumeLabel(entry.current))
          : t('已读 {0}%', bookPercent(entry.current, progress))
        : '';
  const line = multi
    ? (entry.finished / entry.books.length) * 100
    : bookPercent(entry.current, progress);
  return (
    <article class={`shelf-card ${multi ? 'is-series' : ''}`}>
      <button
        type="button"
        class="shelf-cover-button"
        aria-label={t(
          multi ? '查看系列《{0}》' : '阅读《{0}》',
          entry.series.title,
        )}
        onClick={onOpen}
      >
        <BookCover book={entry.current} />
        {multi && (
          <span class="shelf-series-count">
            {t('共 {0} 本', entry.books.length)}
          </span>
        )}
        {status && (
          <span
            class={`shelf-cover-status ${entry.state === 'finished' ? 'finished' : ''}`}
          >
            {status}
          </span>
        )}
        {line > 0 && (
          <span class="shelf-read-line" style={{ width: `${line}%` }} />
        )}
      </button>
      <div class="shelf-card-copy">
        <button type="button" onClick={onOpen} title={entry.series.title}>
          {entry.series.title}
        </button>
        <p>{entryMeta(entry)}</p>
      </div>
      <div class="shelf-card-actions">
        <IconButton
          icon="heart"
          label={t(
            entry.series.favoritedAt === null
              ? '收藏《{0}》'
              : '取消收藏《{0}》',
            entry.series.title,
          )}
          active={entry.series.favoritedAt !== null}
          onClick={onFavorite}
        />
        <IconButton
          icon="more"
          label={t('管理《{0}》', entry.series.title)}
          onClick={() =>
            onManage({
              kind: multi ? 'series' : 'book',
              id: multi ? entry.series.id : entry.current.id,
            })
          }
        />
      </div>
    </article>
  );
}
export function VolumeCard({
  book,
  progress,
  onManage,
  onRead,
}: {
  book: Book;
  progress: ReadonlyMap<string, Progress>;
  onManage: (target: LibraryTarget) => void;
  onRead: (id: string) => void;
}) {
  const percent = bookPercent(book, progress);
  return (
    <article class="shelf-card">
      <button
        type="button"
        class="shelf-cover-button"
        aria-label={t('阅读《{0}》{1}', book.title, volumeLabel(book))}
        onClick={() => onRead(book.id)}
      >
        <BookCover book={book} />
        {bookState(book, progress) !== 'unread' && (
          <span class="shelf-cover-status">
            {t(
              bookState(book, progress) === 'finished' ? '已读完' : '已读 {0}%',
              percent,
            )}
          </span>
        )}
      </button>
      <div class="shelf-card-copy">
        <button type="button" onClick={() => onRead(book.id)}>
          {volumeLabel(book)}
        </button>
        <p>
          {t('{0} 页', book.pageCount)} · {formatBytes(book.sizeBytes)}
        </p>
      </div>
      <div class="shelf-card-actions">
        <IconButton
          icon="more"
          label={t('管理《{0}》{1}', book.title, volumeLabel(book))}
          onClick={() => onManage({ kind: 'book', id: book.id })}
        />
      </div>
    </article>
  );
}
