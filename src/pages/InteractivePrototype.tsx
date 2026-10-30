import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  bookSeriesKey,
  cancelImport,
  clearFinishedImports,
  createGroup,
  demoBooks,
  demoImports,
  demoNotice,
  demoState,
  favorite,
  formatBytes,
  isImportFinished,
  markRead,
  moveSeries,
  openDemoBook,
  openSeries,
  preference,
  removeBooks,
  setSample,
  volumeText,
} from '@/app/demo';
import type { DemoBook, DemoImportJob, ImportStage } from '@/app/demo';
import { DemoCover } from '@/components/DemoArtwork';
import { DemoIcon } from '@/components/DemoIcon';
import type { DemoIconName } from '@/components/DemoIcon';
import {
  DemoDialog,
  DemoImportDialog,
  DemoPreferencesPanel,
  IconButton,
} from '@/components/DemoDialogs';
import {
  compareTitles,
  groupBySeries,
  readingState,
  seriesReadingState,
} from '@/library/series';
import type { ReadingState } from '@/library/series';
import DemoReader from '@/reader/DemoReader';

type Section = 'library' | 'recent' | 'settings';
type Filter = 'all' | ReadingState;
const titles: Record<Section, string> = {
  library: '我的书架',
  recent: '最近阅读',
  settings: '偏好设置',
};

interface SeriesEntry {
  key: string;
  title: string;
  books: DemoBook[];
  /** 封面与“继续”指向的一卷：最近在读，否则第一本未读完的。 */
  current: DemoBook;
  state: ReadingState;
  finishedCount: number;
  lastRead: number;
  added: number;
  size: number;
  group?: string;
}
type ManageTarget =
  { kind: 'series'; entry: SeriesEntry } | { kind: 'book'; book: DemoBook };

function useEntries(books: readonly DemoBook[]): SeriesEntry[] {
  const { progress, seriesGroups } = demoState.value;
  return useMemo(
    () =>
      groupBySeries(books, (book) => ({
        key: bookSeriesKey(book),
        volume: book.volume,
        name: book.fileName,
      })).map(({ key, items }) => {
        const states = items.map((book) =>
          readingState(progress[book.id]?.page, book.pages),
        );
        const reading = items
          .filter((_, index) => states[index] === 'reading')
          .sort((a, b) => progress[b.id]!.at - progress[a.id]!.at)[0];
        return {
          key,
          title: items[0]!.title,
          books: items,
          current:
            reading ??
            items.find((_, index) => states[index] !== 'finished') ??
            items[0]!,
          state: seriesReadingState(states),
          finishedCount: states.filter((state) => state === 'finished').length,
          lastRead: Math.max(
            0,
            ...items.map((book) => progress[book.id]?.at ?? 0),
          ),
          added: Math.max(...items.map((book) => book.added)),
          size: items.reduce((total, book) => total + book.size, 0),
          group: seriesGroups[key],
        };
      }),
    [books, progress, seriesGroups],
  );
}

function percentOf(book: DemoBook): number {
  const page = demoState.value.progress[book.id]?.page;
  return page === undefined ? 0 : Math.round(((page + 1) / book.pages) * 100);
}
function entryStatus(entry: SeriesEntry): string {
  if (entry.books.length === 1) {
    if (entry.state === 'finished') return '已读完';
    return entry.state === 'reading' ? `已读 ${percentOf(entry.current)}%` : '';
  }
  if (entry.state === 'finished') return '全部读完';
  return entry.state === 'reading' ? `读到${volumeText(entry.current)}` : '';
}
function entryMeta(entry: SeriesEntry): string {
  const first = entry.books[0]!;
  if (entry.books.length > 1)
    return `${entry.books.length} ${first.unit} · 已读完 ${entry.finishedCount}`;
  return [volumeText(first), `${first.pages} 页`, first.format]
    .filter(Boolean)
    .join(' · ');
}

function ShelfCard({
  entry,
  list,
  onManage,
}: {
  entry: SeriesEntry;
  list: boolean;
  onManage: (target: ManageTarget) => void;
}) {
  const multi = entry.books.length > 1;
  const status = entryStatus(entry);
  const liked = demoState.value.favorites.includes(entry.key);
  const line = multi
    ? (entry.finishedCount / entry.books.length) * 100
    : percentOf(entry.current);
  const open = () =>
    multi ? openSeries(entry.key) : openDemoBook(entry.current);
  return (
    <article
      class={`demo-book-card ${list ? 'is-list' : ''} ${multi ? 'is-series' : ''}`}
    >
      <button
        class="book-cover-button"
        onClick={open}
        aria-label={
          multi
            ? `查看系列《${entry.title}》，共 ${entry.books.length} ${entry.books[0]!.unit}`
            : `阅读《${entry.title}》${volumeText(entry.current)}`
        }
      >
        <DemoCover book={entry.current} />
        {multi && (
          <span class="series-count">
            {entry.books.length}
            <small>{entry.books[0]!.unit}</small>
          </span>
        )}
        {status && (
          <span
            class={`cover-status ${entry.state === 'finished' ? 'is-finished' : ''}`}
          >
            {entry.state === 'finished' && <DemoIcon name="check" size={12} />}
            {status}
          </span>
        )}
        {line > 0 && (
          <span class="cover-read-line" style={{ width: `${line}%` }} />
        )}
      </button>
      <div class="book-card-copy">
        <button class="book-title-button" onClick={open} title={entry.title}>
          {entry.title}
        </button>
        <p>{entryMeta(entry)}</p>
      </div>
      <div class="book-card-actions">
        <IconButton
          icon="heart"
          label={`${liked ? '取消收藏' : '收藏'}《${entry.title}》`}
          active={liked}
          onClick={() => favorite(entry.key)}
        />
        <IconButton
          icon="more"
          label={`管理《${entry.title}》`}
          onClick={() =>
            onManage(
              multi
                ? { kind: 'series', entry }
                : { kind: 'book', book: entry.current },
            )
          }
        />
      </div>
    </article>
  );
}

function VolumeCard({
  book,
  onManage,
}: {
  book: DemoBook;
  onManage: (target: ManageTarget) => void;
}) {
  const percent = percentOf(book);
  return (
    <article class="demo-book-card">
      <button
        class="book-cover-button"
        onClick={() => openDemoBook(book)}
        aria-label={`阅读《${book.title}》${volumeText(book)}`}
      >
        <DemoCover book={book} />
        {percent === 100 ? (
          <span class="cover-status is-finished">
            <DemoIcon name="check" size={12} />
            已读完
          </span>
        ) : (
          percent > 0 && <span class="cover-status">已读 {percent}%</span>
        )}
        {percent > 0 && (
          <span class="cover-read-line" style={{ width: `${percent}%` }} />
        )}
      </button>
      <div class="book-card-copy">
        <button
          class="book-title-button"
          onClick={() => openDemoBook(book)}
          title={book.fileName}
        >
          {volumeText(book) || book.fileName}
        </button>
        <p>
          {book.pages} 页 · {formatBytes(book.size)}
        </p>
      </div>
      <div class="book-card-actions">
        <IconButton
          icon="more"
          label={`管理${volumeText(book) || book.fileName}`}
          onClick={() => onManage({ kind: 'book', book })}
        />
      </div>
    </article>
  );
}

function GroupSelect({
  series,
  onNewGroup,
}: {
  series: string;
  onNewGroup: (series: string) => void;
}) {
  const { groups, seriesGroups } = demoState.value;
  return (
    <label class="group-move">
      <span>所在分组</span>
      <select
        value={seriesGroups[series] ?? ''}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (value === '__new') {
            event.currentTarget.value = seriesGroups[series] ?? '';
            onNewGroup(series);
          } else moveSeries(series, value || null);
        }}
      >
        <option value="">未分组</option>
        {groups.map((group) => (
          <option value={group.id}>{group.name}</option>
        ))}
        <option value="__new">新建分组…</option>
      </select>
    </label>
  );
}

function ManageDialog({
  target,
  onClose,
  onNewGroup,
}: {
  target: ManageTarget;
  onClose: () => void;
  onNewGroup: (series: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const books = target.kind === 'series' ? target.entry.books : [target.book];
  const book = target.kind === 'series' ? target.entry.current : target.book;
  const series = bookSeriesKey(book);
  const size = books.reduce((total, item) => total + item.size, 0);
  const allRead = books.every(
    (item) =>
      readingState(demoState.value.progress[item.id]?.page, item.pages) ===
      'finished',
  );
  const name =
    target.kind === 'series'
      ? `《${book.title}》全部 ${books.length} ${book.unit}`
      : `《${book.title}》${volumeText(book)}`;
  const progressPage = demoState.value.progress[book.id]?.page;
  return (
    <DemoDialog
      title={target.kind === 'series' ? '管理系列' : '这本漫画'}
      onClose={onClose}
    >
      <div class="book-details">
        <DemoCover book={book} />
        <div>
          <h3>{book.title}</h3>
          <p>
            {target.kind === 'series'
              ? `${books.length} ${book.unit}`
              : volumeText(book) || '单本'}
          </p>
          <dl>
            {target.kind === 'book' && (
              <div class="is-file">
                <dt>文件</dt>
                <dd>{book.fileName}</dd>
              </div>
            )}
            <div>
              <dt>格式</dt>
              <dd>
                {[...new Set(books.map((item) => item.format))].join(' / ')}
              </dd>
            </div>
            <div>
              <dt>{target.kind === 'series' ? '总大小' : '大小'}</dt>
              <dd>{formatBytes(size)}</dd>
            </div>
            <div>
              <dt>页数</dt>
              <dd>{books.reduce((total, item) => total + item.pages, 0)} 页</dd>
            </div>
            {target.kind === 'book' && (
              <div>
                <dt>进度</dt>
                <dd>
                  {progressPage === undefined
                    ? '未读'
                    : `第 ${progressPage + 1} / ${book.pages} 页`}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
      <GroupSelect series={series} onNewGroup={onNewGroup} />
      {confirming ? (
        <div class="delete-confirm" role="alert">
          <p>
            从书架删除{name}？App 内保存的副本（{formatBytes(size)}
            ）、阅读位置和书签会一并清除，你的原文件不受影响。
          </p>
          <div>
            <button class="demo-secondary" onClick={() => setConfirming(false)}>
              取消
            </button>
            <button
              class="demo-danger"
              onClick={() => {
                removeBooks(books);
                onClose();
                if (location.hash.startsWith('#series/')) {
                  const left = demoBooks.value.some(
                    (item) => bookSeriesKey(item) === series,
                  );
                  if (!left) location.hash = '';
                }
              }}
            >
              删除
            </button>
          </div>
        </div>
      ) : (
        <div class="manage-actions">
          {target.kind === 'book' && (
            <button
              class="demo-primary"
              onClick={() => {
                openDemoBook(book);
                onClose();
              }}
            >
              {progressPage === undefined ? '开始阅读' : '继续阅读'}
            </button>
          )}
          <button
            class="demo-secondary"
            onClick={() => markRead(books, !allRead)}
          >
            {allRead
              ? '标记为未读'
              : target.kind === 'series'
                ? '全部标记为读完'
                : '标记为读完'}
          </button>
          <button class="demo-text-danger" onClick={() => setConfirming(true)}>
            {target.kind === 'series' ? '删除整个系列' : '从书架删除'}
          </button>
        </div>
      )}
    </DemoDialog>
  );
}

function GroupDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  return (
    <DemoDialog
      title="新建分组"
      subtitle="分组由你自己决定，例如“通勤时看”“已完结”。"
      onClose={onClose}
    >
      <form
        class="group-form"
        onSubmit={(event) => {
          event.preventDefault();
          const id = createGroup(name);
          if (id) onCreated(id);
        }}
      >
        <input
          ref={input}
          value={name}
          maxLength={20}
          aria-label="分组名称"
          placeholder="分组名称"
          onInput={(event) => setName(event.currentTarget.value)}
        />
        <button class="demo-primary" disabled={!name.trim()}>
          创建
        </button>
      </form>
    </DemoDialog>
  );
}

const stageText: Record<ImportStage, string> = {
  waiting: '等待中',
  copying: '正在复制',
  checking: '正在检查',
  saving: '正在保存',
  done: '已加入书架',
  duplicate: '已跳过',
  failed: '导入失败',
  cancelled: '已取消',
};
function ImportTray({ jobs }: { jobs: readonly DemoImportJob[] }) {
  const finished = jobs.filter(isImportFinished).length;
  const active = finished < jobs.length;
  return (
    <section class="import-tray" aria-label="导入进度" aria-live="polite">
      <header>
        <strong>
          {active
            ? `正在导入 ${finished + 1} / ${jobs.length}`
            : `导入完成 · 成功 ${jobs.filter((job) => job.stage === 'done').length} 本`}
        </strong>
        {!active && (
          <button class="demo-secondary" onClick={clearFinishedImports}>
            清除记录
          </button>
        )}
      </header>
      <ul>
        {jobs.map((job) => (
          <li class={`import-job stage-${job.stage}`} key={job.id}>
            <span class="import-job-name" title={job.fileName}>
              {job.fileName}
            </span>
            <span class="import-job-status">
              {job.message ?? stageText[job.stage]}
              {job.stage === 'copying' &&
                ` ${Math.round(job.progress * 100)}% · ${formatBytes(job.size)}`}
            </span>
            {(job.stage === 'waiting' || job.stage === 'copying') && (
              <button
                class="import-job-cancel"
                aria-label={`取消导入 ${job.fileName}`}
                onClick={() => cancelImport(job.id)}
              >
                取消
              </button>
            )}
            {!isImportFinished(job) && (
              <span class="import-job-bar">
                <i
                  style={{
                    width: `${job.stage === 'copying' ? job.progress * 100 : job.stage === 'waiting' ? 0 : 100}%`,
                  }}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function FirstRun({ onImport }: { onImport: () => void }) {
  return (
    <section class="first-run" aria-label="开始使用">
      <span class="first-run-icon">
        <DemoIcon name="book" size={34} />
      </span>
      <h2>书架还是空的</h2>
      <p>微光漫画只读你自己的漫画文件，不内置、也不联网获取任何内容。</p>
      <ol class="first-run-steps">
        <li>
          <b>从“文件”导入</b>
          <span>选择 CBZ、ZIP 压缩包或整个图片文件夹，可以一次多选。</span>
        </li>
        <li>
          <b>从其他 App 打开</b>
          <span>在“文件”、网盘或聊天里点分享，选择“微光漫画”。</span>
        </li>
        <li>
          <b>自动整理</b>
          <span>同一系列的多卷按卷号排在一起，阅读位置自动记住。</span>
        </li>
      </ol>
      <div class="first-run-actions">
        <button class="demo-primary" onClick={onImport}>
          <DemoIcon name="plus" size={18} />
          导入漫画
        </button>
        <button class="demo-secondary" onClick={() => setSample('curated')}>
          先看演示书架
        </button>
      </div>
    </section>
  );
}

export default function InteractivePrototype() {
  const [hash, setHash] = useState(location.hash);
  const [section, setSection] = useState<Section>('library');
  const [filter, setFilter] = useState<Filter>('all');
  // 收藏是书架上的一个筛选，不再单独占一个页面。
  const [favOnly, setFavOnly] = useState(false);
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const [group, setGroup] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('recent');
  const [importing, setImporting] = useState(false);
  const [manage, setManage] = useState<ManageTarget | null>(null);
  const [newGroupFor, setNewGroupFor] = useState<string | null | undefined>();
  const prefs = demoState.value.preferences;
  const { progress, favorites, groups, sample } = demoState.value;
  const books = demoBooks.value;
  const jobs = demoImports.value;
  const entries = useEntries(books);
  const readingBook = hash.startsWith('#read/')
    ? books.find((book) => book.id === hash.slice(6))
    : undefined;
  const seriesPage = hash.startsWith('#series/')
    ? entries.find((entry) => entry.key === decodeURIComponent(hash.slice(8)))
    : undefined;
  useEffect(() => {
    const update = () => setHash(location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const theme =
    prefs.theme === 'system' ? (systemDark ? 'night' : 'paper') : prefs.theme;
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = '微光漫画 · 交互原型';
  }, [theme]);
  useEffect(() => {
    if (
      group !== 'all' &&
      group !== 'none' &&
      !groups.some((item) => item.id === group)
    )
      setGroup('all');
  }, [groups, group]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !readingBook &&
        !(event.target instanceof HTMLInputElement) &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault();
        document.getElementById('demo-search')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readingBook]);
  const continueBooks = books
    .filter(
      (book) => readingState(progress[book.id]?.page, book.pages) === 'reading',
    )
    .sort((a, b) => progress[b.id]!.at - progress[a.id]!.at)
    .slice(0, 3);
  const grouped = entries.filter(
    (entry) =>
      group === 'all' ||
      (group === 'none' ? !entry.group : entry.group === group),
  );
  const favoriteCount = grouped.filter((entry) =>
    favorites.includes(entry.key),
  ).length;
  const scoped = grouped.filter(
    (entry) =>
      (!favOnly || favorites.includes(entry.key)) &&
      (section !== 'recent' || entry.lastRead > 0),
  );
  const counts: Record<Filter, number> = {
    all: scoped.length,
    reading: scoped.filter((entry) => entry.state === 'reading').length,
    unread: scoped.filter((entry) => entry.state === 'unread').length,
    finished: scoped.filter((entry) => entry.state === 'finished').length,
  };
  const needle = query.trim().toLowerCase();
  const visible = scoped
    .filter(
      (entry) =>
        (filter === 'all' || entry.state === filter) &&
        (!needle ||
          entry.books.some((book) =>
            `${book.title} ${book.fileName} ${book.subtitle ?? ''}`
              .toLowerCase()
              .includes(needle),
          )),
    )
    .sort((a, b) =>
      section === 'recent'
        ? b.lastRead - a.lastRead
        : sort === 'title'
          ? compareTitles(a.title, b.title)
          : sort === 'added'
            ? b.added - a.added
            : b.lastRead - a.lastRead || b.added - a.added,
    );
  const groupName = groups.find((item) => item.id === group)?.name;
  function navigate(next: Section, favoritesOnly = false) {
    setSection(next);
    setFavOnly(favoritesOnly);
    setGroup('all');
    setFilter('all');
    setQuery('');
    location.hash = '';
  }
  const navigation: {
    id: string;
    section: Section;
    label: string;
    icon: DemoIconName;
    favorites: boolean;
    count: number;
  }[] = [
    {
      id: 'library',
      section: 'library',
      label: '书架',
      icon: 'shelf',
      favorites: false,
      count: entries.length,
    },
    {
      id: 'recent',
      section: 'recent',
      label: '最近阅读',
      icon: 'clock',
      favorites: false,
      count: entries.filter((entry) => entry.lastRead > 0).length,
    },
    {
      id: 'favorites',
      section: 'library',
      label: '我的收藏',
      icon: 'heart',
      favorites: true,
      count: entries.filter((entry) => favorites.includes(entry.key)).length,
    },
  ];
  const firstRun = !books.length && !jobs.length && section === 'library';
  const heading =
    section !== 'library'
      ? titles[section]
      : group !== 'all'
        ? (groupName ?? '未分组')
        : favOnly
          ? '我的收藏'
          : titles.library;

  return (
    <div class={`demo-app ${readingBook ? 'has-reader' : ''}`}>
      {readingBook ? (
        <DemoReader
          key={readingBook.id}
          book={readingBook}
          onBack={() => {
            const series = bookSeriesKey(readingBook);
            const multi =
              books.filter((book) => bookSeriesKey(book) === series).length > 1;
            if (multi) openSeries(series);
            else location.hash = '';
          }}
        />
      ) : (
        <div class="demo-shell">
          <aside class="demo-sidebar">
            <a
              href="#"
              class="demo-brand"
              onClick={(event) => {
                event.preventDefault();
                navigate('library');
              }}
            >
              <span class="brand-mark">
                <DemoIcon name="book" size={25} />
                <i />
              </span>
              <span>
                微光漫画<small>LUMI COMIC</small>
              </span>
            </a>
            <div class="sidebar-divider" />
            <nav class="sidebar-nav" aria-label="主导航">
              {navigation.map((item) => {
                const selected =
                  section === item.section &&
                  !seriesPage &&
                  group === 'all' &&
                  favOnly === item.favorites;
                return (
                  <button
                    type="button"
                    class={selected ? 'selected' : ''}
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => navigate(item.section, item.favorites)}
                  >
                    <DemoIcon name={item.icon} />
                    <span>{item.label}</span>
                    <small>{item.count}</small>
                  </button>
                );
              })}
            </nav>
            <div class="sidebar-collections">
              <p>
                我的分组<span>{groups.length}</span>
              </p>
              {groups.map((item, i) => (
                <button
                  class={group === item.id ? 'selected' : ''}
                  onClick={() => {
                    navigate('library');
                    setGroup(item.id);
                  }}
                >
                  <i class={i % 2 ? 'category-dot is-blue' : 'category-dot'} />
                  {item.name}
                  <span>
                    {entries.filter((entry) => entry.group === item.id).length}
                  </span>
                </button>
              ))}
              <button
                class={group === 'none' ? 'selected' : ''}
                onClick={() => {
                  navigate('library');
                  setGroup('none');
                }}
              >
                <i class="category-dot is-empty" />
                未分组
                <span>{entries.filter((entry) => !entry.group).length}</span>
              </button>
              <button
                class="sidebar-new-group"
                onClick={() => setNewGroupFor(null)}
              >
                <DemoIcon name="plus" size={15} />
                新建分组
              </button>
            </div>
            <div class="sidebar-bottom">
              <div class="local-promise">
                <DemoIcon name="leaf" size={19} />
                <span>
                  只读你自己的文件<small>不联网，不需要账号</small>
                </span>
              </div>
              <button
                class={`sidebar-settings ${section === 'settings' ? 'selected' : ''}`}
                onClick={() => navigate('settings')}
              >
                <DemoIcon name="settings" />
                <span>偏好设置</span>
                <DemoIcon name="right" size={15} />
              </button>
              <span class="sidebar-version">
                交互预览 <i>·</i> 0.2
              </span>
            </div>
          </aside>
          <div class="demo-main">
            <header class="demo-topbar">
              <div class="breadcrumb">
                <span>微光漫画</span>
                <DemoIcon name="right" size={13} />
                <b>{seriesPage ? seriesPage.title : heading}</b>
              </div>
              <div class="topbar-actions">
                <label class="demo-search">
                  <DemoIcon name="search" size={17} />
                  <input
                    id="demo-search"
                    placeholder="搜索漫画"
                    aria-label="搜索书架"
                    value={query}
                    onInput={(event) => {
                      setQuery(event.currentTarget.value);
                      if (seriesPage) location.hash = '';
                    }}
                  />
                  <kbd>/</kbd>
                </label>
                <IconButton
                  icon={theme === 'paper' ? 'moon' : 'sun'}
                  label={theme === 'paper' ? '切换到深色' : '切换到浅色'}
                  onClick={() =>
                    preference({
                      theme: theme === 'paper' ? 'night' : 'paper',
                    })
                  }
                />
                {section === 'library' && !firstRun && (
                  <span class="topbar-mobile-only">
                    <IconButton
                      icon="plus"
                      label="导入漫画"
                      onClick={() => setImporting(true)}
                    />
                  </span>
                )}
                <span class="prototype-chip">交互预览</span>
              </div>
            </header>
            <main class="demo-content">
              {seriesPage ? (
                <section
                  class="series-page"
                  aria-label={`系列《${seriesPage.title}》`}
                >
                  <button
                    class="series-back"
                    onClick={() => (location.hash = '')}
                  >
                    <DemoIcon name="left" size={17} />
                    书架
                  </button>
                  <div class="series-hero">
                    <span class="series-hero-cover">
                      <DemoCover book={seriesPage.current} />
                    </span>
                    <div>
                      <h1>{seriesPage.title}</h1>
                      <p>
                        {entryMeta(seriesPage)} · {formatBytes(seriesPage.size)}
                      </p>
                      <div class="series-hero-actions">
                        <button
                          class="demo-primary"
                          onClick={() => openDemoBook(seriesPage.current)}
                        >
                          {seriesPage.state === 'unread'
                            ? '开始阅读'
                            : seriesPage.state === 'finished'
                              ? '从第 1 卷重读'
                              : '继续阅读'}
                          <span class="series-hero-target">
                            {volumeText(seriesPage.current)}
                          </span>
                        </button>
                        <IconButton
                          icon="heart"
                          label={
                            favorites.includes(seriesPage.key)
                              ? '取消收藏'
                              : '收藏系列'
                          }
                          active={favorites.includes(seriesPage.key)}
                          onClick={() => favorite(seriesPage.key)}
                        />
                        <IconButton
                          icon="more"
                          label="管理系列"
                          onClick={() =>
                            setManage({ kind: 'series', entry: seriesPage })
                          }
                        />
                      </div>
                      <GroupSelect
                        series={seriesPage.key}
                        onNewGroup={setNewGroupFor}
                      />
                    </div>
                  </div>
                  <div class="demo-book-grid series-volumes">
                    {seriesPage.books.map((book) => (
                      <VolumeCard
                        key={book.id}
                        book={book}
                        onManage={setManage}
                      />
                    ))}
                  </div>
                </section>
              ) : (
                <>
                  <div class="page-heading">
                    <div>
                      <h1>
                        {heading}
                        <span class="title-dot">.</span>
                      </h1>
                    </div>
                    {section !== 'settings' && !firstRun && (
                      <button
                        class="demo-primary"
                        onClick={() => setImporting(true)}
                      >
                        <DemoIcon name="plus" size={18} />
                        导入漫画
                      </button>
                    )}
                  </div>
                  {section === 'settings' ? (
                    <div class="settings-page">
                      <DemoPreferencesPanel />
                    </div>
                  ) : firstRun ? (
                    <FirstRun onImport={() => setImporting(true)} />
                  ) : (
                    <>
                      {jobs.length > 0 && <ImportTray jobs={jobs} />}
                      {section === 'library' &&
                        !favOnly &&
                        group === 'all' &&
                        !query &&
                        continueBooks.length > 0 && (
                          <section class="continue-strip" aria-label="继续阅读">
                            <h2>继续阅读</h2>
                            <div>
                              {continueBooks.map((book) => {
                                const page = progress[book.id]!.page;
                                return (
                                  <button
                                    class="continue-card"
                                    key={book.id}
                                    onClick={() => openDemoBook(book)}
                                  >
                                    <span class="continue-card-cover">
                                      <DemoCover book={book} small />
                                    </span>
                                    <span class="continue-card-copy">
                                      <strong>{book.title}</strong>
                                      <small>
                                        {[
                                          volumeText(book),
                                          `第 ${page + 1} / ${book.pages} 页`,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </small>
                                      <span class="continue-card-bar">
                                        <i
                                          style={{
                                            width: `${percentOf(book)}%`,
                                          }}
                                        />
                                      </span>
                                    </span>
                                    <DemoIcon name="arrow" size={18} />
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        )}
                      <section class="shelf-section" aria-label="漫画书架">
                        <div class="shelf-toolbar">
                          <div class="shelf-filters" aria-label="阅读状态筛选">
                            {(
                              [
                                { id: 'all', label: '全部' },
                                { id: 'reading', label: '阅读中' },
                                { id: 'unread', label: '未读' },
                                { id: 'finished', label: '已读完' },
                              ] as const
                            )
                              // 最近页只列读过的书，“未读”恒为 0。
                              .filter(
                                (item) =>
                                  section !== 'recent' || item.id !== 'unread',
                              )
                              .map((item) => (
                                <button
                                  class={filter === item.id ? 'selected' : ''}
                                  aria-pressed={filter === item.id}
                                  onClick={() => setFilter(item.id)}
                                >
                                  {item.label}
                                  <span>{counts[item.id]}</span>
                                </button>
                              ))}
                            {section === 'library' && (
                              <button
                                class={`filter-favorites ${favOnly ? 'selected' : ''}`}
                                aria-pressed={favOnly}
                                onClick={() => setFavOnly((value) => !value)}
                              >
                                <DemoIcon name="heart" size={15} />
                                收藏
                                <span>{favoriteCount}</span>
                              </button>
                            )}
                          </div>
                          <div class="shelf-view-controls">
                            {/* 最近页固定按阅读时间排列，不提供分组与排序。 */}
                            {section === 'library' && (
                              <>
                                <label class="sort-control group-filter">
                                  <span class="sr-only">按分组筛选</span>
                                  <select
                                    value={group}
                                    aria-label="按分组筛选"
                                    onChange={(event) => {
                                      const value = event.currentTarget.value;
                                      if (value === '__new')
                                        setNewGroupFor(null);
                                      else setGroup(value);
                                    }}
                                  >
                                    <option value="all">全部分组</option>
                                    {groups.map((item) => (
                                      <option value={item.id}>
                                        {item.name}
                                      </option>
                                    ))}
                                    <option value="none">未分组</option>
                                    <option value="__new">新建分组…</option>
                                  </select>
                                  <DemoIcon name="chevron" size={13} />
                                </label>
                                <label class="sort-control">
                                  <span class="sr-only">书架排序</span>
                                  <select
                                    value={sort}
                                    aria-label="书架排序"
                                    onChange={(event) =>
                                      setSort(event.currentTarget.value)
                                    }
                                  >
                                    <option value="recent">最近阅读</option>
                                    <option value="added">最近导入</option>
                                    <option value="title">书名顺序</option>
                                  </select>
                                  <DemoIcon name="chevron" size={13} />
                                </label>
                                <span class="view-divider" />
                              </>
                            )}
                            <IconButton
                              icon="grid"
                              label="封面网格"
                              active={layout === 'grid'}
                              onClick={() => setLayout('grid')}
                            />
                            <IconButton
                              icon="list"
                              label="书目列表"
                              active={layout === 'list'}
                              onClick={() => setLayout('list')}
                            />
                          </div>
                        </div>
                        {visible.length ? (
                          <div
                            class={`demo-book-grid ${layout === 'list' ? 'list-layout' : ''}`}
                          >
                            {visible.map((entry) => (
                              <ShelfCard
                                key={entry.key}
                                entry={entry}
                                list={layout === 'list'}
                                onManage={setManage}
                              />
                            ))}
                          </div>
                        ) : (
                          <div class="demo-empty">
                            <DemoIcon
                              name={query ? 'search' : 'book'}
                              size={38}
                            />
                            <h2>
                              {query ? '没有找到匹配的漫画' : '这里还没有漫画'}
                            </h2>
                            <p>
                              {query
                                ? '试试书名里的其他字，或文件名的一部分。'
                                : '换个筛选，或把漫画移到这个分组。'}
                            </p>
                            <button
                              class="demo-secondary"
                              onClick={() => {
                                setQuery('');
                                setFilter('all');
                                setGroup('all');
                                setFavOnly(false);
                              }}
                            >
                              查看全部漫画
                            </button>
                          </div>
                        )}
                        <footer class="shelf-footer">
                          <span>
                            {visible.length} 个系列 <i>·</i>{' '}
                            {visible.reduce(
                              (total, entry) => total + entry.books.length,
                              0,
                            )}{' '}
                            本
                            {sample === 'realistic' && (
                              <>
                                {' '}
                                <i>·</i> 真实文件名样本
                              </>
                            )}
                          </span>
                          <span>
                            <DemoIcon name="leaf" size={14} />
                            本地保存，无需联网
                          </span>
                        </footer>
                      </section>
                    </>
                  )}
                </>
              )}
            </main>
          </div>
          {/* 手机底部标签栏，与主流阅读 App 一致：书架 / 最近 / 设置。 */}
          <nav class="demo-mobile-nav" aria-label="主导航">
            {(
              [
                { section: 'library', label: '书架', icon: 'shelf' },
                { section: 'recent', label: '最近', icon: 'clock' },
                { section: 'settings', label: '设置', icon: 'settings' },
              ] as const
            ).map((item) => (
              <button
                class={section === item.section ? 'selected' : ''}
                aria-current={section === item.section ? 'page' : undefined}
                onClick={() => navigate(item.section)}
              >
                <DemoIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>
      )}
      {importing && <DemoImportDialog onClose={() => setImporting(false)} />}
      {manage && !newGroupFor && newGroupFor !== null && (
        <ManageDialog
          target={manage}
          onClose={() => setManage(null)}
          onNewGroup={setNewGroupFor}
        />
      )}
      {newGroupFor !== undefined && (
        <GroupDialog
          onClose={() => setNewGroupFor(undefined)}
          onCreated={(id) => {
            if (newGroupFor) moveSeries(newGroupFor, id);
            else if (!seriesPage) {
              navigate('library');
              setGroup(id);
            }
            setNewGroupFor(undefined);
          }}
        />
      )}
      <div
        class={`demo-toast ${demoNotice.value ? 'visible' : ''}`}
        role="status"
        aria-live="polite"
      >
        <DemoIcon name="check" size={17} />
        {demoNotice.value}
      </div>
    </div>
  );
}
