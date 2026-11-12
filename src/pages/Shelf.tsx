import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Setting } from '@/db/models';
import {
  LibraryContext,
  defaultLibraryServices,
  useLibrary,
  type LibraryServices,
} from '@/app/libraryServices';
import { useShelf } from '@/app/useShelf';
import { importError, pickingFiles, pickComics } from '@/app/library';
import { supportsImport } from '@/native/comicImport';
import { setStatusBarTone } from '@/native/systemBars';
import { useAndroidBack } from '@/native/androidBack';
import {
  buildShelf,
  selectShelf,
  continuingBooks,
  bookPercent,
  type ShelfFilter,
} from '@/library/shelf';
import { toggleSeriesFavorite, type LibraryTarget } from '@/library/actions';
import { FileCleanupQueue } from '@/library/FileCleanupQueue';
import { t, languagePreference, validLanguage } from '@/i18n';
import { Icon, type IconName } from '@/components/Icon';
import {
  IconButton,
  LibraryDialog,
  formatBytes,
} from '@/components/LibraryControls';
import {
  ShelfCard,
  VolumeCard,
  volumeLabel,
  entryMeta,
} from '@/components/ShelfCards';
import { BookCover } from '@/components/BookCover';
import {
  ManageDialog,
  GroupDialog,
  GroupSelect,
  actionError,
  type GroupEditor,
} from '@/components/LibraryDialogs';
import { ImportStatus } from '@/components/ImportStatus';
import { ProDialog } from '@/components/ProDialog';
import { PrivacyDialog } from '@/components/PrivacyDialog';
import { BatchDialog, type BatchOption } from '@/components/BatchDialog';
import { proStore } from '@/app/pro';
import { canPerform, proEntryVisible } from '@/app/proPolicy';
import { appLock, lockAvailable } from '@/app/appLockService';
import { Reader } from '@/reader/Reader';
import '@/styles/shelf.css';

type Section = 'library' | 'recent' | 'settings';
const filters: readonly { id: ShelfFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'reading', label: '阅读中' },
  { id: 'unread', label: '未读' },
  { id: 'finished', label: '已读完' },
];
export function Shelf({
  services = defaultLibraryServices,
}: {
  services?: LibraryServices;
}) {
  return (
    <LibraryContext.Provider value={services}>
      <ShelfContent />
    </LibraryContext.Provider>
  );
}
function ShelfContent() {
  const { db, archive, nativeAvailable } = useLibrary();
  const { snapshot, state, retry } = useShelf(db);
  const [section, setSection] = useState<Section>('library');
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ShelfFilter>('all');
  const [favorites, setFavorites] = useState(false);
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [manage, setManage] = useState<LibraryTarget | null>(null);
  const [proOpen, setProOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchOption[] | null>(null);
  const pro = proStore().state.value;
  const lock = appLock();
  const lockState = lock.state.value;
  // 隐藏的系列只在本次打开期间按需显示，不保存。
  const [showHidden, setShowHidden] = useState(false);
  const proVisible = pro.status === 'pro' || proEntryVisible(pro.environment);
  const [reading, setReading] = useState<string | null>(null);
  const returnPosition = useRef(0);
  const [groupEditor, setGroupEditor] = useState<GroupEditor | null>(null);
  const [error, setError] = useState('');
  useAndroidBack(() => {
    if (reading || lockState.locked) return false;
    if (seriesId) setSeriesId(null);
    else if (section !== 'library') setSection('library');
    else if (query) setQuery('');
    else if (group !== 'all' || favorites || filter !== 'all') {
      setGroup('all');
      setFavorites(false);
      setFilter('all');
    } else return false;
    return true;
  });
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const cleanup = useMemo(
    () => new FileCleanupQueue(db, archive),
    [db, archive],
  );
  const progress = useMemo(
    () => new Map(snapshot.progress.map((item) => [item.bookId, item])),
    [snapshot.progress],
  );
  const entries = useMemo(
    () => buildShelf(snapshot.books, snapshot.series, progress, showHidden),
    [snapshot.books, snapshot.series, progress, showHidden],
  );
  const selected = entries.find((entry) => entry.series.id === seriesId);
  const sortSetting = snapshot.settings.find(
    (item) => item.key === 'library.sort',
  );
  const sort =
    sortSetting?.key === 'library.sort' ? sortSetting.value : 'lastReadAt';
  const layoutSetting = snapshot.settings.find(
    (item) => item.key === 'library.layout',
  );
  const layout =
    layoutSetting?.key === 'library.layout' ? layoutSetting.value : 'grid';
  const appearanceSetting = snapshot.settings.find(
    (item) => item.key === 'ui.appearance',
  );
  const appearance =
    appearanceSetting?.key === 'ui.appearance'
      ? appearanceSetting.value
      : 'system';
  const selection = selectShelf(entries, {
    group,
    favorites,
    recent: section === 'recent',
    filter,
    query,
    sort,
  });
  const continuing = continuingBooks(entries, progress);
  const filtered =
    query.trim() !== '' || filter !== 'all' || favorites || group !== 'all';
  const heading =
    section === 'settings'
      ? t('偏好设置')
      : section === 'recent'
        ? t('最近阅读')
        : group !== 'all'
          ? (snapshot.groups.find((item) => item.id === group)?.name ??
            t('未分组'))
          : favorites
            ? t('我的收藏')
            : t('我的书架');
  const available = supportsImport();
  const firstRun = snapshot.books.length === 0 && section === 'library';
  const [systemDark, setSystemDark] = useState(
    () => matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const theme =
    appearance === 'system' ? (systemDark ? 'night' : 'paper') : appearance;
  useEffect(() => {
    if (nativeAvailable)
      void cleanup
        .drain()
        .catch(() => setError(t('副本清理暂时无法继续，请重试。')));
  }, [cleanup, nativeAvailable]);
  useEffect(() => {
    if (state === 'ready' && seriesId && !selected) setSeriesId(null);
  }, [state, seriesId, selected]);
  useEffect(() => {
    if (
      group === 'all' ||
      group === 'none' ||
      snapshot.groups.some((item) => item.id === group)
    )
      return;
    // 新建分组刚提交时，liveQuery 快照可能尚未到达；确认数据库里也不存在才退出分组。
    let current = true;
    void db.libraryGroups
      .get(group)
      .then((record) => {
        if (current && !record) setGroup('all');
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [group, snapshot.groups, db]);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      setSystemDark(media.matches);
      const next =
        appearance === 'system'
          ? media.matches
            ? 'night'
            : 'paper'
          : appearance;
      document.documentElement.dataset.appearance = appearance;
      document.documentElement.dataset.theme = next;
      // 阅读器按自己的背景设置状态栏，返回书架后再恢复。
      if (reading === null)
        setStatusBarTone(next === 'night' ? 'dark' : 'light');
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [appearance, reading]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.key === '/' &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLSelectElement) &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault();
        document.getElementById('shelf-search')?.focus();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  function navigate(next: Section, liked = false) {
    setSection(next);
    setFavorites(liked);
    setSeriesId(null);
    setGroup('all');
    setFilter('all');
    setQuery('');
    setError('');
  }
  async function saveSetting(setting: Setting) {
    try {
      await db.settings.put(setting);
    } catch (error: unknown) {
      setError(actionError(error));
    }
  }
  function favorite(id: string) {
    void toggleSeriesFavorite(db, id).catch((error) =>
      setError(actionError(error)),
    );
  }
  function newGroup(seriesId?: string) {
    setGroupEditor({ kind: 'create', seriesId });
  }
  function beginBatch() {
    if (!canPerform('batch.apply', pro.status === 'pro')) {
      setProOpen(true);
      return;
    }
    setBatchItems(
      selected
        ? selected.books.map((book) => ({
            target: { kind: 'book', id: book.id },
            title: `${book.title} · ${volumeLabel(book)}`,
            detail: book.fileName ?? t('{0} 页', book.pageCount),
            bookIds: [book.id],
          }))
        : selection.visible.map((entry) => ({
            target: { kind: 'series', id: entry.series.id },
            title: entry.series.title,
            detail: t('共 {0} 本', entry.books.length),
            bookIds: entry.books.map((book) => book.id),
          })),
    );
  }
  function openBook(id: string) {
    returnPosition.current = window.scrollY;
    setManage(null);
    setReading(id);
  }
  function closeReader() {
    setReading(null);
    requestAnimationFrame(() =>
      window.scrollTo({ top: returnPosition.current, behavior: 'instant' }),
    );
  }
  const navigation: readonly {
    id: Section;
    label: string;
    icon: IconName;
    count?: number;
  }[] = [
    { id: 'library', label: '书架', icon: 'shelf', count: entries.length },
    {
      id: 'recent',
      label: '最近阅读',
      icon: 'clock',
      count: entries.filter((entry) => entry.lastRead > 0).length,
    },
    { id: 'settings', label: '设置', icon: 'settings' },
  ];
  const importButton = (
    <button
      type="button"
      class="shelf-primary"
      disabled={!available || pickingFiles.value}
      onClick={() => setImportOpen(true)}
    >
      <Icon name="plus" size={18} />
      {t(pickingFiles.value ? '正在选择文件…' : '导入漫画')}
    </button>
  );
  return (
    <>
      <div
        class="library-shell"
        inert={reading !== null}
        aria-hidden={reading !== null ? true : undefined}
      >
        <aside class="library-sidebar">
          <button
            class="library-brand"
            aria-label={t('微光漫卷')}
            type="button"
            onClick={() => navigate('library')}
          >
            <span class="library-brand-mark">
              <Icon name="book" size={27} />
            </span>
            <span>
              {t('微光漫卷')}
              <small>LUMI COMIC</small>
            </span>
          </button>
          <nav aria-label={t('主导航')}>
            {navigation.map((item) => (
              <button
                type="button"
                key={item.id}
                class={
                  section === item.id && !favorites && group === 'all'
                    ? 'selected'
                    : ''
                }
                aria-current={
                  section === item.id && !favorites && group === 'all'
                    ? 'page'
                    : undefined
                }
                aria-label={t(item.label)}
                title={t(item.label)}
                onClick={() => navigate(item.id)}
              >
                <Icon name={item.icon} />
                <span>{t(item.label)}</span>
                {item.count !== undefined && <small>{item.count}</small>}
              </button>
            ))}
            <button
              type="button"
              class={favorites ? 'selected' : ''}
              aria-label={t('我的收藏')}
              title={t('我的收藏')}
              onClick={() => navigate('library', true)}
            >
              <Icon name="heart" />
              <span>{t('我的收藏')}</span>
              <small>
                {
                  entries.filter((entry) => entry.series.favoritedAt !== null)
                    .length
                }
              </small>
            </button>
          </nav>
          <div class="library-groups">
            <p>
              {t('我的分组')}
              <span>{snapshot.groups.length}</span>
            </p>
            {snapshot.groups.map((item) => (
              <button
                type="button"
                key={item.id}
                class={group === item.id ? 'selected' : ''}
                onClick={() => {
                  navigate('library');
                  setGroup(item.id);
                }}
              >
                <Icon name="folder" size={16} />
                <span>{item.name}</span>
                <small>
                  {
                    entries.filter((entry) => entry.series.groupId === item.id)
                      .length
                  }
                </small>
              </button>
            ))}
            <button
              type="button"
              class={group === 'none' ? 'selected' : ''}
              onClick={() => {
                navigate('library');
                setGroup('none');
              }}
            >
              <Icon name="folder" size={16} />
              <span>{t('未分组')}</span>
            </button>
            <button type="button" onClick={() => newGroup()}>
              <Icon name="plus" size={16} />
              {t('新建分组')}
            </button>
          </div>
          <div class="library-promise">
            <Icon name="leaf" />
            <span>
              {t('只读你自己的文件')}
              <small>{t('不联网，不需要账号')}</small>
            </span>
          </div>
        </aside>
        <div class="library-main">
          <header class="library-topbar">
            <div class="library-breadcrumb">
              <span>{t('微光漫卷')}</span>
              <Icon name="right" size={14} />
              <b>{selected?.series.title ?? heading}</b>
            </div>
            <label class="library-search">
              <Icon name="search" size={18} />
              <input
                id="shelf-search"
                aria-label={t('搜索书架')}
                placeholder={t('搜索漫画')}
                value={query}
                onInput={(event) => {
                  setQuery(event.currentTarget.value);
                  setSeriesId(null);
                  if (section === 'settings') setSection('library');
                }}
              />
              <kbd>/</kbd>
            </label>
            <IconButton
              icon={theme === 'night' ? 'sun' : 'moon'}
              label={t('切换外观')}
              onClick={() =>
                void saveSetting({
                  key: 'ui.appearance',
                  value: theme === 'night' ? 'paper' : 'night',
                })
              }
            />
            <span class="library-mobile-import">
              <IconButton
                icon="plus"
                label={t('导入漫画')}
                disabled={!available || pickingFiles.value}
                onClick={() => setImportOpen(true)}
              />
            </span>
          </header>
          <main class="library-content">
            {state === 'loading' ? (
              <p role="status">{t('正在打开书架…')}</p>
            ) : state === 'error' ? (
              <section class="library-empty" role="alert">
                <h1>{t('暂时无法读取书架')}</h1>
                <button type="button" onClick={retry}>
                  {t('重试')}
                </button>
              </section>
            ) : (
              <>
                {error && (
                  <div class="shelf-alert" role="alert">
                    <p>{error}</p>
                    <IconButton
                      icon="close"
                      label={t('关闭提示')}
                      onClick={() => setError('')}
                    />
                  </div>
                )}
                {snapshot.cleanup.length > 0 && (
                  <section class="shelf-alert" aria-live="polite">
                    <p>
                      {t(
                        '书目已移除，还有 {0} 个 App 副本待清理。原文件不受影响。',
                        snapshot.cleanup.length,
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={!nativeAvailable || cleanupBusy}
                      onClick={() => {
                        setCleanupBusy(true);
                        void cleanup
                          .drain()
                          .catch(() =>
                            setError(t('副本清理暂时无法继续，请重试。')),
                          )
                          .finally(() => setCleanupBusy(false));
                      }}
                    >
                      {t(cleanupBusy ? '正在清理…' : '重试清理')}
                    </button>
                  </section>
                )}
                {importError.value && (
                  <p role="alert" class="shelf-error">
                    {t(importError.value)}
                  </p>
                )}
                {selected ? (
                  <section
                    class="library-series"
                    aria-label={t('系列《{0}》', selected.series.title)}
                  >
                    <button
                      type="button"
                      class="shelf-back"
                      onClick={() => setSeriesId(null)}
                    >
                      <Icon name="left" size={18} />
                      {t('书架')}
                    </button>
                    <div class="library-series-hero">
                      <BookCover book={selected.current} />
                      <div>
                        <h1>{selected.series.title}</h1>
                        <p>
                          {entryMeta(selected)} · {formatBytes(selected.size)}
                        </p>
                        <div class="library-series-actions">
                          <button
                            type="button"
                            class="shelf-primary"
                            onClick={() => openBook(selected.current.id)}
                          >
                            {t(
                              selected.state === 'unread'
                                ? '开始阅读'
                                : '继续阅读',
                            )}
                            <span>{volumeLabel(selected.current)}</span>
                          </button>
                          <IconButton
                            icon="heart"
                            label={t(
                              selected.series.favoritedAt === null
                                ? '收藏系列'
                                : '取消收藏',
                            )}
                            active={selected.series.favoritedAt !== null}
                            onClick={() => favorite(selected.series.id)}
                          />
                          <IconButton
                            icon="more"
                            label={t('管理系列')}
                            onClick={() =>
                              setManage({
                                kind: 'series',
                                id: selected.series.id,
                              })
                            }
                          />
                        </div>
                        <GroupSelect
                          seriesId={selected.series.id}
                          groupId={selected.series.groupId}
                          groups={snapshot.groups}
                          onNew={newGroup}
                          onError={setError}
                        />
                        {proVisible && (
                          <button type="button" onClick={beginBatch}>
                            {t('批量整理')} · Pro
                          </button>
                        )}
                      </div>
                    </div>
                    <div class="shelf-grid">
                      {selected.books.map((book) => (
                        <VolumeCard
                          key={book.id}
                          book={book}
                          progress={progress}
                          onManage={setManage}
                          onRead={openBook}
                        />
                      ))}
                    </div>
                  </section>
                ) : (
                  <>
                    <div class="library-heading">
                      <h1>
                        {heading}
                        <span aria-hidden="true">.</span>
                      </h1>
                      {section !== 'settings' && !firstRun && proVisible && (
                        <button
                          type="button"
                          onClick={beginBatch}
                          disabled={!selection.visible.length}
                        >
                          {t('批量整理')} · Pro
                        </button>
                      )}
                      {section !== 'settings' && !firstRun && importButton}
                    </div>
                    {section === 'settings' ? (
                      <section
                        class="library-settings"
                        aria-label={t('偏好设置')}
                      >
                        <div class="shelf-settings-row">
                          <div>
                            <h2>{t('外观')}</h2>
                            <p>{t('外观默认跟随系统，阅读背景单独设置。')}</p>
                          </div>
                          <select
                            aria-label={t('外观')}
                            value={appearance}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              if (
                                value === 'system' ||
                                value === 'paper' ||
                                value === 'night'
                              )
                                void saveSetting({
                                  key: 'ui.appearance',
                                  value,
                                });
                            }}
                          >
                            <option value="system">{t('跟随系统')}</option>
                            <option value="paper">{t('浅色')}</option>
                            <option value="night">{t('深色')}</option>
                          </select>
                        </div>
                        <div class="shelf-settings-row">
                          <div>
                            <h2>{t('界面语言')}</h2>
                          </div>
                          <select
                            aria-label={t('界面语言')}
                            value={languagePreference.value}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              if (validLanguage(value)) {
                                languagePreference.value = value;
                                try {
                                  localStorage.setItem(
                                    'lumicomic.ui.language',
                                    value,
                                  );
                                } catch {
                                  setError(t('操作未完成，请重试。'));
                                }
                              }
                            }}
                          >
                            <option value="system">{t('跟随系统')}</option>
                            <option value="zh-Hans">{t('简体中文')}</option>
                            <option value="en">{t('English')}</option>
                          </select>
                        </div>
                        {proEntryVisible(pro.environment) && (
                          <div class="shelf-settings-row">
                            <div>
                              <h2>{t('微光 Pro')}</h2>
                              <p>
                                {pro.status === 'pro'
                                  ? t('已解锁微光 Pro')
                                  : t('一次买断，后续更新免费获得。')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setProOpen(true)}
                            >
                              {t('查看')}
                            </button>
                          </div>
                        )}
                        {lockAvailable() &&
                          (lockState.enabled || proVisible) && (
                            <div class="shelf-settings-row">
                              <div>
                                <h2>
                                  {t('应用锁')}
                                  <em class="shelf-pro-tag">Pro</em>
                                </h2>
                                <p>
                                  {t(
                                    lockState.error === 'no-passcode'
                                      ? '请先在系统设置中设置设备密码。'
                                      : lockState.error === 'failed'
                                        ? '验证未通过，应用锁没有开启。'
                                        : lockState.error === 'save-failed'
                                          ? '设置未保存，请重试。'
                                          : lockState.notice ===
                                              'disabled-no-passcode'
                                            ? '设备已关闭密码，应用锁已自动关闭。'
                                            : '打开 App 或从后台回来时需要面容 ID 或密码，多任务界面不显示内容。',
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                aria-pressed={lockState.enabled}
                                disabled={lockState.busy}
                                onClick={() => {
                                  if (lockState.enabled) void lock.disable();
                                  else if (
                                    !canPerform(
                                      'lock.enable',
                                      pro.status === 'pro',
                                    )
                                  )
                                    setProOpen(true);
                                  else void lock.enable(true);
                                }}
                              >
                                {t(lockState.enabled ? '关闭' : '开启')}
                              </button>
                            </div>
                          )}
                        {snapshot.series.some((item) => item.hidden) && (
                          <div class="shelf-settings-row">
                            <div>
                              <h2>{t('隐藏的系列')}</h2>
                              <p>
                                {t(
                                  showHidden
                                    ? '隐藏的系列正在书架中显示，关闭 App 后恢复隐藏。'
                                    : '隐藏的系列不出现在书架、最近和搜索中。',
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              aria-pressed={showHidden}
                              onClick={() => setShowHidden((value) => !value)}
                            >
                              {t(showHidden ? '不再显示' : '显示')}
                            </button>
                          </div>
                        )}
                        <div class="shelf-settings-row">
                          <h2>{t('我的分组')}</h2>
                          <button type="button" onClick={() => newGroup()}>
                            <Icon name="plus" size={16} />
                            {t('新建分组')}
                          </button>
                        </div>
                        <ul class="shelf-settings-groups">
                          {snapshot.groups.map((item) => (
                            <li key={item.id}>
                              <span>{item.name}</span>
                              <button
                                type="button"
                                aria-label={t('管理分组《{0}》', item.name)}
                                onClick={() =>
                                  setGroupEditor({ kind: 'edit', group: item })
                                }
                              >
                                {t('管理')}
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div class="shelf-settings-row">
                          <div>
                            <h2>{t('隐私政策')}</h2>
                            <p>
                              {t(
                                '不收集任何个人信息，数据只保存在这台设备上。',
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrivacyOpen(true)}
                          >
                            {t('查看')}
                          </button>
                        </div>
                        <p class="shelf-muted">{t('数据只在这台设备上')}</p>
                      </section>
                    ) : (
                      <>
                        <ImportStatus jobs={snapshot.jobs} db={db} />
                        {firstRun ? (
                          <section class="library-first-run">
                            <span class="library-first-icon">
                              <Icon name="book" size={36} />
                            </span>
                            <h2>{t('书架还是空的')}</h2>
                            <p>
                              {t(
                                '微光漫卷只读你自己的漫画文件，不内置、也不联网获取任何内容。',
                              )}
                            </p>
                            <ol>
                              <li>
                                <b>{t('从“文件”导入')}</b>
                                <span>
                                  {t(
                                    '选择自己的 ZIP、CBZ、PDF 或 EPUB 文件，可以一次多选。',
                                  )}
                                </span>
                              </li>
                              <li>
                                <b>{t('自动整理')}</b>
                                <span>
                                  {t(
                                    '同一系列按卷、话排在一起，也可以创建自己的分组。',
                                  )}
                                </span>
                              </li>
                            </ol>
                            {importButton}
                            {!available && (
                              <p class="shelf-muted">
                                {t('请在支持文件导入的移动端应用中添加漫画。')}
                              </p>
                            )}
                          </section>
                        ) : (
                          <>
                            {section === 'library' &&
                              group === 'all' &&
                              !favorites &&
                              !query.trim() &&
                              filter === 'all' &&
                              continuing.length > 0 && (
                                <section
                                  class="library-continuing"
                                  aria-label={t('继续阅读')}
                                >
                                  <h2>{t('继续阅读')}</h2>
                                  <div>
                                    {continuing.map((book) => (
                                      <button
                                        type="button"
                                        class="shelf-continue-card"
                                        key={book.id}
                                        aria-label={t(
                                          '继续阅读《{0}》{1}',
                                          book.title,
                                          volumeLabel(book),
                                        )}
                                        onClick={() => openBook(book.id)}
                                      >
                                        <BookCover book={book} />
                                        <span class="shelf-continue-copy">
                                          <strong>
                                            {entries.find(
                                              (entry) =>
                                                entry.series.id ===
                                                book.seriesId,
                                            )?.series.title ?? book.title}
                                          </strong>
                                          <small>
                                            {volumeLabel(book)} ·{' '}
                                            {t(
                                              '第 {0} / {1} 页',
                                              (progress.get(book.id)?.page ??
                                                0) + 1,
                                              book.pageCount,
                                            )}
                                          </small>
                                          <span class="shelf-continue-progress">
                                            <i
                                              style={{
                                                width: `${bookPercent(book, progress)}%`,
                                              }}
                                            />
                                          </span>
                                        </span>
                                        <Icon name="arrow" size={18} />
                                      </button>
                                    ))}
                                  </div>
                                </section>
                              )}
                            <section aria-label={t('漫画书架')}>
                              <div class="library-toolbar">
                                <div
                                  class="library-filters"
                                  aria-label={t('阅读状态筛选')}
                                >
                                  {filters
                                    .filter(
                                      (item) =>
                                        section !== 'recent' ||
                                        item.id !== 'unread',
                                    )
                                    .map((item) => (
                                      <button
                                        type="button"
                                        key={item.id}
                                        class={
                                          filter === item.id ? 'selected' : ''
                                        }
                                        aria-pressed={filter === item.id}
                                        onClick={() => setFilter(item.id)}
                                      >
                                        {t(item.label)}
                                        <span>{selection.counts[item.id]}</span>
                                      </button>
                                    ))}
                                  {section === 'library' && (
                                    <button
                                      type="button"
                                      class={favorites ? 'selected' : ''}
                                      aria-pressed={favorites}
                                      onClick={() =>
                                        setFavorites((value) => !value)
                                      }
                                    >
                                      <Icon name="heart" size={16} />
                                      {t('收藏')}
                                      <span>{selection.favoriteCount}</span>
                                    </button>
                                  )}
                                </div>
                                <div class="library-view-controls">
                                  {section === 'library' && (
                                    <>
                                      <select
                                        aria-label={t('按分组筛选')}
                                        value={group}
                                        onChange={(event) => {
                                          const value =
                                            event.currentTarget.value;
                                          if (value === '__new') {
                                            event.currentTarget.value = group;
                                            newGroup();
                                          } else setGroup(value);
                                        }}
                                      >
                                        <option value="all">
                                          {t('全部分组')}
                                        </option>
                                        {snapshot.groups.map((item) => (
                                          <option key={item.id} value={item.id}>
                                            {item.name}
                                          </option>
                                        ))}
                                        <option value="none">
                                          {t('未分组')}
                                        </option>
                                        <option value="__new">
                                          {t('新建分组…')}
                                        </option>
                                      </select>
                                      <select
                                        aria-label={t('书架排序')}
                                        value={sort}
                                        onChange={(event) => {
                                          const value =
                                            event.currentTarget.value;
                                          if (
                                            value === 'title' ||
                                            value === 'importedAt' ||
                                            value === 'lastReadAt'
                                          )
                                            void saveSetting({
                                              key: 'library.sort',
                                              value,
                                            });
                                        }}
                                      >
                                        <option value="lastReadAt">
                                          {t('最近阅读')}
                                        </option>
                                        <option value="importedAt">
                                          {t('最近导入')}
                                        </option>
                                        <option value="title">
                                          {t('书名顺序')}
                                        </option>
                                      </select>
                                    </>
                                  )}
                                  <IconButton
                                    icon="grid"
                                    label={t('封面网格')}
                                    active={layout === 'grid'}
                                    onClick={() =>
                                      void saveSetting({
                                        key: 'library.layout',
                                        value: 'grid',
                                      })
                                    }
                                  />
                                  <IconButton
                                    icon="list"
                                    label={t('书目列表')}
                                    active={layout === 'list'}
                                    onClick={() =>
                                      void saveSetting({
                                        key: 'library.layout',
                                        value: 'list',
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              {selection.visible.length ? (
                                <div
                                  class={`shelf-grid ${layout === 'list' ? 'shelf-list-layout' : ''}`}
                                >
                                  {selection.visible.map((entry) => (
                                    <ShelfCard
                                      key={entry.series.id}
                                      entry={entry}
                                      progress={progress}
                                      onOpen={() =>
                                        entry.books.length > 1
                                          ? setSeriesId(entry.series.id)
                                          : openBook(entry.current.id)
                                      }
                                      onManage={setManage}
                                      onFavorite={() =>
                                        favorite(entry.series.id)
                                      }
                                    />
                                  ))}
                                </div>
                              ) : filtered ? (
                                <section class="library-empty">
                                  <Icon name="search" size={32} />
                                  <h2>{t('没有找到漫画')}</h2>
                                  <p>{t('试试其他关键词或筛选条件。')}</p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQuery('');
                                      setFilter('all');
                                      setFavorites(false);
                                      setGroup('all');
                                    }}
                                  >
                                    {t('清除筛选')}
                                  </button>
                                </section>
                              ) : (
                                // 没有任何筛选时不提示“换关键词”，例如还没读过漫画的“最近阅读”。
                                <section class="library-empty">
                                  <Icon
                                    name={
                                      section === 'recent' ? 'clock' : 'book'
                                    }
                                    size={32}
                                  />
                                  <h2>{t('这里还没有漫画')}</h2>
                                  {section === 'recent' && (
                                    <p>{t('打开一本漫画后会显示在这里。')}</p>
                                  )}
                                </section>
                              )}
                              <p class="shelf-footer">
                                {t(
                                  '共 {0} 个系列 · {1} 本漫画',
                                  selection.visible.length,
                                  selection.visible.reduce(
                                    (sum, entry) => sum + entry.books.length,
                                    0,
                                  ),
                                )}
                              </p>
                            </section>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </main>
        </div>
        <nav class="library-bottom-nav" aria-label={t('底部导航')}>
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={section === item.id ? 'page' : undefined}
              class={section === item.id ? 'selected' : ''}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{t(item.id === 'recent' ? '最近' : item.label)}</span>
            </button>
          ))}
        </nav>
        {importOpen && (
          <LibraryDialog
            title={t('添加漫画')}
            onClose={() => setImportOpen(false)}
          >
            <div class="shelf-import-choices">
              <button
                type="button"
                class="shelf-primary"
                onClick={() => {
                  setImportOpen(false);
                  void pickComics();
                }}
              >
                {t('导入副本（免费）')}
              </button>
              <p>{t('在 App 内保存一份，原文件移动或删除后仍可阅读。')}</p>
              {proVisible && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setImportOpen(false);
                      if (!canPerform('inplace.add', pro.status === 'pro'))
                        setProOpen(true);
                      else void pickComics('inplace');
                    }}
                  >
                    {t('原位阅读')} · Pro
                  </button>
                  <p>
                    {t(
                      '不复制原文件，仅保存访问授权与页面缓存。请保留原件，云盘文件需先下载；移动或移除后可能需要重新选择。',
                    )}
                  </p>
                </>
              )}
            </div>
          </LibraryDialog>
        )}
        {proOpen && <ProDialog onClose={() => setProOpen(false)} />}
        {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
        {batchItems && (
          <BatchDialog
            items={batchItems}
            groups={snapshot.groups}
            onClose={() => setBatchItems(null)}
            onApplied={() => {
              setBatchItems(null);
              void cleanup
                .drain()
                .catch(() => setError(t('副本清理暂时无法继续，请重试。')));
            }}
            onPro={() => {
              setBatchItems(null);
              setProOpen(true);
            }}
          />
        )}
        {manage && (
          <ManageDialog
            key={`${manage.kind}:${manage.id}`}
            target={manage}
            entries={entries}
            progress={progress}
            groups={snapshot.groups}
            cleanup={cleanup}
            onClose={() => setManage(null)}
            onNewGroup={newGroup}
            onRead={openBook}
            canHide={proVisible}
            proActive={pro.status === 'pro'}
            onPro={() => {
              setManage(null);
              setProOpen(true);
            }}
          />
        )}
        {groupEditor && (
          <GroupDialog
            editor={groupEditor}
            onClose={() => setGroupEditor(null)}
            onCreated={(id) => {
              setGroupEditor(null);
              if (groupEditor.kind === 'create' && !groupEditor.seriesId) {
                navigate('library');
                setGroup(id);
              }
            }}
          />
        )}
      </div>
      {reading && (
        <Reader
          bookId={reading}
          onOpen={setReading}
          onBack={closeReader}
          backLabel={t(selected ? '返回系列' : '返回书架')}
        />
      )}
    </>
  );
}
