import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import type { Book, ReaderDefaults } from '@/db/models';
import { useLibrary } from '@/app/libraryServices';
import { localPageUrl, type RenderedPage } from '@/native/comicArchive';
import { Icon } from '@/components/Icon';
import { BookCover } from '@/components/BookCover';
import { LibraryDialog } from '@/components/LibraryControls';
import { volumeLabel } from '@/components/ShelfCards';
import { t } from '@/i18n';
import { PageLoader } from './PageLoader';
import {
  openReading,
  ProgressWriter,
  ReadingError,
  clampPage,
  type ReadingSession,
} from './progress';
import { buildSpreads, spreadDisplayOrder, spreadIndexOf } from './spread';
import {
  visiblePages,
  visibleAnchor,
  pageWindow,
  nextVolume,
  scrollLayout,
  positionAt,
  topAt,
  type ReadingPosition,
} from './layout';
import { saveCropBorders, saveReaderPreferences } from './preferences';
import { proStore } from '@/app/pro';
import { canPerform, proEntryVisible } from '@/app/proPolicy';
import { ProDialog, type ProPreview } from '@/components/ProDialog';
import { RelinkSource } from '@/components/RelinkSource';
import { useReaderGestures } from './useReaderGestures';
import { nextZoom } from './zoom';
import { ReaderContents } from './ReaderContents';
import { useBookmarks } from './useBookmarks';
import { readerBrightness, dimmingOpacity, folioHeight } from './appearance';
import { AutoplayClock, autoplayInterval, autoplaySpeed } from './autoplay';
import { setNativeKeepAwake } from '@/native/comicReader';
import { useFullscreen } from './useFullscreen';
import { setStatusBarTone } from '@/native/systemBars';
import '@/styles/reader.css';

interface ReaderProps {
  bookId: string;
  onBack: () => void;
  onOpen: (bookId: string) => void;
  backLabel: string;
}
export function Reader({ bookId, onBack, onOpen, backLabel }: ReaderProps) {
  const { db, fullscreen: displayPort } = useLibrary();
  const fullscreen = useFullscreen(displayPort);
  const exitRequested = useRef(false);
  async function leaveReader() {
    if (exitRequested.current) return;
    exitRequested.current = true;
    await fullscreen.release();
    onBack();
  }
  const [reading, setReading] = useState<ReadingSession | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setReading(null);
    setError('');
    void openReading(db, bookId)
      .then((next) => {
        if (!cancelled) setReading(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setError(
          error instanceof ReadingError
            ? t(
                error.code === 'BOOK_MISSING'
                  ? '这本漫画已不在书架中。'
                  : error.code === 'BOOK_UNAVAILABLE'
                    ? '漫画文件暂时不可用，请检查文件后重新导入。'
                    : '无法读取这本漫画的页目录，请重新导入。',
              )
            : t('暂时无法打开漫画，请重试。'),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [db, bookId, attempt]);
  if (reading?.book.id === bookId)
    return (
      <ReadingView
        key={`${bookId}:${attempt}`}
        reading={reading}
        onBack={() => void leaveReader()}
        onOpen={onOpen}
        backLabel={backLabel}
        fullscreen={fullscreen}
        onSourceChanged={() => setAttempt((value) => value + 1)}
      />
    );
  return (
    <section
      class="comic-reader"
      data-background="paper"
      aria-label={t('漫画阅读器')}
    >
      <div class="reader-message" role={error ? 'alert' : 'status'}>
        <h1>{t(error ? '无法打开漫画' : '正在打开漫画…')}</h1>
        {error && <p>{error}</p>}
        <div>
          {error && (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              {t('重试')}
            </button>
          )}
          <button type="button" onClick={() => void leaveReader()}>
            {backLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function ReadingView({
  reading,
  onBack,
  onOpen,
  backLabel,
  fullscreen,
  onSourceChanged,
}: {
  reading: ReadingSession;
  onBack: () => void;
  onOpen: (id: string) => void;
  backLabel: string;
  fullscreen: ReturnType<typeof useFullscreen>;
  onSourceChanged: () => void;
}) {
  const { db, archive, nativeAvailable } = useLibrary();
  const [prefs, setPrefs] = useState<ReaderDefaults>({
    ...reading.defaults,
    mode: reading.book.mode ?? reading.defaults.mode,
    direction: reading.book.direction ?? reading.defaults.direction,
    spreadCover:
      reading.book.mode === 'spread'
        ? reading.book.spreadOffset === 1
          ? 'paired'
          : 'alone'
        : (reading.defaults.spreadCover ?? 'alone'),
  });
  const [page, setPage] = useState(reading.page);
  const [chrome, setChrome] = useState(false);
  const [guide, setGuide] = useState(!reading.guideSeen && nativeAvailable);
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideError, setGuideError] = useState(false);
  const [settings, setSettings] = useState(false);
  const [contents, setContents] = useState<'pages' | 'bookmarks' | null>(null);
  const bookmarks = useBookmarks(db, reading.book.id, reading.pages.length);
  const [brightnessPreview, setBrightnessPreview] = useState<number | null>(
    null,
  );
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState(false);
  const [autoPlaying, setAutoPlaying] = useState(false);
  const autoRequested = useRef(false);
  const lastAutoRecord = useRef(0);
  const [featureProOpen, setFeatureProOpen] = useState(false);
  const pro = proStore().state.value;
  const [crop, setCrop] = useState(reading.book.cropBorders);
  // 失去 Pro 后保留这本书的选择，但按原图显示；重新解锁后自动恢复。
  const cropActive = crop && pro.status === 'pro';
  const [proPreview, setProPreview] = useState<ProPreview | null>(null);
  const [images, setImages] = useState(new Map<number, RenderedPage>());
  const [loadVersion, setLoadVersion] = useState(0);
  const [errors, setErrors] = useState(new Set<number>());
  const [ratios, setRatios] = useState(new Map<number, number>());
  const [revision, setRevision] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [closing, setClosing] = useState(false);
  const [ended, setEnded] = useState(false);
  const [nextBook, setNextBook] = useState<Book | undefined>();
  const [nextError, setNextError] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(375);
  const [viewportSize, setViewportSize] = useState({ width: 375, height: 812 });
  const mounted = useRef(true),
    appActive = useRef(true),
    leaving = useRef(false);
  const saveVersion = useRef(0),
    lastRecorded = useRef('');
  const loaded = useRef(new Map<number, string>());
  const position = useRef<ReadingPosition>({
    page: reading.page,
    offset: reading.offset,
  });
  const pendingScroll = useRef<ReadingPosition | null>({ ...position.current });
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const scroll = prefs.mode === 'scroll';
  const cover = prefs.spreadCover ?? 'alone';
  const spreads = useMemo(
    () => buildSpreads(reading.pages.length, cover),
    [reading.pages.length, cover],
  );
  const visible = useMemo(
    () => visiblePages(page, reading.pages.length, prefs.mode, cover),
    [page, reading.pages.length, prefs.mode, cover],
  );
  const requests = useMemo(
    () => pageWindow(visible, reading.pages.length),
    [visible, reading.pages.length],
  );
  const requestKey = requests.join(',');
  const geometry = useMemo(
    () => scrollLayout(reading.pages.length, width, ratios),
    [reading.pages.length, width, ratios],
  );
  const geometryRef = useRef(geometry);
  geometryRef.current = geometry;
  const current = useRef({
    page,
    visible,
    prefs,
    guide,
    settings,
    contents,
    scroll,
    ended,
  });
  current.current = {
    page,
    visible,
    prefs,
    guide,
    settings,
    contents,
    scroll,
    ended,
  };
  const loader = useMemo(
    () =>
      new PageLoader(
        { bookId: reading.book.id, path: reading.book.path, crop: cropActive },
        reading.pages,
        async (options) => localPageUrl(await archive.renderPage(options)),
      ),
    [reading, archive, cropActive],
  );
  const writer = useMemo(
    () =>
      new ProgressWriter(
        db,
        reading.book.id,
        reading.defaults.remember !== false,
      ),
    [db, reading.book.id],
  );
  const keyFor = (index: number, image: RenderedPage) =>
    `${index}:${image.url}:${revision}`;
  const ready = (index: number) => {
    const image = images.get(index);
    return (
      !!image &&
      !errors.has(index) &&
      loaded.current.get(index) === keyFor(index, image)
    );
  };

  function recordVisible(ignoreGuide = false) {
    const state = current.current;
    if (
      leaving.current ||
      !appActive.current ||
      document.visibilityState !== 'visible' ||
      state.settings ||
      state.contents !== null ||
      state.prefs.remember === false ||
      (state.guide && !ignoreGuide)
    )
      return;
    const indices = state.scroll ? [position.current.page] : state.visible;
    // 双页整体确认后才写入锚点；单侧损坏或尚在加载时不把另一侧预读算作整组读完。
    if (!indices.length || !indices.every(ready)) return;
    const anchor =
      state.prefs.mode === 'spread'
        ? visibleAnchor(indices, reading.pages.length)
        : indices[0]!;
    const offset = state.scroll ? position.current.offset : 0;
    const signature = `${anchor}:${offset.toFixed(4)}:${indices.map((index) => loaded.current.get(index)).join('|')}`;
    if (signature === lastRecorded.current) return;
    lastRecorded.current = signature;
    const version = ++saveVersion.current;
    void writer
      .record(anchor, offset)
      .then(() => {
        if (mounted.current && version === saveVersion.current)
          setSaveError(false);
      })
      .catch(() => {
        if (mounted.current && version === saveVersion.current) {
          setSaveError(true);
          setChrome(true);
        }
      });
  }
  const controls = useRef({ recordVisible });
  controls.current = { recordVisible };
  function stopAutoplay() {
    if (!autoRequested.current) return;
    autoRequested.current = false;
    setAutoPlaying(false);
    syncScroll();
    controls.current.recordVisible();
  }
  useEffect(() => () => loader.dispose(), [loader]);
  useEffect(() => {
    mounted.current = true;
    const overflow = document.body.style.overflow;
    const focus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = 'hidden';
    stage.current?.focus({ preventScroll: true });
    return () => {
      mounted.current = false;
      leaving.current = true;
      clearTimeout(scrollTimer.current);
      document.body.style.overflow = overflow;
      focus?.focus({ preventScroll: true });
      void writer.flush().catch(() => undefined);
    };
  }, [writer]);
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const resize = () => {
      stopAutoplay();
      setWidth(Math.max(1, Math.min(900, node.clientWidth)));
      setViewportSize({ width: node.clientWidth, height: node.clientHeight });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (!scroll || !stage.current) return;
    const target = pendingScroll.current ?? position.current;
    pendingScroll.current = null;
    stage.current.scrollTop = topAt(geometry, target);
    position.current = { ...target };
  }, [scroll, geometry]);
  useEffect(() => {
    if (!nativeAvailable || recovering || contents !== null) return;
    const version = loader.moveWindow(requests);
    let cancelled = false;
    setImages(
      new Map(
        requests.flatMap((index) => {
          const cached = loader.get(index);
          return cached ? [[index, cached] as const] : [];
        }),
      ),
    );
    for (const index of loaded.current.keys())
      if (!requests.includes(index)) loaded.current.delete(index);
    void (async () => {
      for (const index of requests) {
        try {
          const rendered = await loader.load(index, 8192, version);
          if (cancelled) return;
          if (rendered) {
            setImages((previous) => new Map(previous).set(index, rendered));
            setErrors((previous) => {
              const next = new Set(previous);
              next.delete(index);
              return next;
            });
            setRatios((previous) => {
              const ratio =
                rendered.sourceHeight / Math.max(1, rendered.sourceWidth);
              return previous.get(index) === ratio
                ? previous
                : new Map(previous).set(index, ratio);
            });
          }
        } catch {
          if (!cancelled) setErrors((previous) => new Set(previous).add(index));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestKey, revision, recovering, loader, nativeAvailable, contents]);
  useEffect(() => {
    recordVisible();
  }, [page, prefs, guide, images, revision, loadVersion, settings, contents]);
  useEffect(() => {
    const flush = () => {
      stopAutoplay();
      controls.current.recordVisible();
      void writer.flush().catch(() => {
        if (mounted.current) {
          setSaveError(true);
          setChrome(true);
        }
      });
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
      else controls.current.recordVisible();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    const native =
      Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')
        ? NativeApp.addListener('appStateChange', (event) => {
            appActive.current = event.isActive;
            if (!event.isActive) flush();
            else controls.current.recordVisible();
          }).catch(() => null)
        : null;
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', visibility);
      if (native)
        void native.then((handle) => handle?.remove()).catch(() => undefined);
    };
  }, [writer]);
  useEffect(() => {
    let cancelled = false;
    if (!reading.book.seriesId) return;
    void db.books
      .where('seriesId')
      .equals(reading.book.seriesId)
      .toArray()
      .then((books) => {
        if (!cancelled) setNextBook(nextVolume(reading.book, books));
      })
      .catch(() => {
        if (!cancelled) setNextError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, reading.book, ended]);

  function syncScroll() {
    const node = stage.current;
    if (!node || !current.current.scroll || pendingScroll.current) return;
    position.current = positionAt(geometryRef.current, node.scrollTop);
    setPage(position.current.page);
  }
  function go(target: number, offset = 0) {
    if (closing || guide) return;
    syncScroll();
    recordVisible();
    clearTimeout(scrollTimer.current);
    const value = clampPage(target, reading.pages.length);
    position.current = { page: value, offset: scroll ? offset : 0 };
    if (scroll && stage.current)
      stage.current.scrollTop = topAt(geometry, position.current);
    setPage(value);
    setEnded(false);
  }
  function step(delta: number) {
    if (
      closing ||
      guide ||
      settings ||
      contents !== null ||
      bookmarks.locked.current
    )
      return;
    if (ended) {
      if (delta < 0) setEnded(false);
      return;
    }
    if (scroll) {
      if (
        delta > 0 &&
        page === reading.pages.length - 1 &&
        ready(page) &&
        stage.current
      )
        stage.current.scrollTop = geometry.at(-1) ?? 0;
      else go(page + delta);
      return;
    }
    const target =
      prefs.mode === 'spread'
        ? spreadIndexOf(spreads, page) + delta
        : page + delta;
    if (
      target >=
      (prefs.mode === 'spread' ? spreads.length : reading.pages.length)
    ) {
      recordVisible();
      if (visible.every(ready)) {
        setEnded(true);
        setChrome(true);
      }
      return;
    }
    go(
      prefs.mode === 'spread'
        ? (spreads[Math.max(0, target)]?.[0] ?? 0)
        : target,
    );
  }
  const gestures = useReaderGestures({
    stage,
    scroll,
    blocked:
      guide || closing || settings || contents !== null || bookmarks.busy,
    panY: prefs.fit === 'width',
    ended,
    chrome,
    direction: prefs.direction,
    resetKey: `${prefs.mode}:${cover}:${prefs.fit ?? 'page'}:${visible.join(',')}:${ended}`,
    setChrome,
    step,
  });
  const autoFrame = useRef<(now: number, clock: AutoplayClock) => boolean>(
    () => false,
  );
  autoFrame.current = (now, clock) => {
    const node = stage.current;
    const activePages = scroll ? [position.current.page] : visible;
    const decision = clock.tick(now, {
      key: `${prefs.mode}:${activePages.join(',')}:${revision}`,
      scroll,
      ready: activePages.every(ready),
      failed: activePages.some((index) => errors.has(index)),
      blocked:
        !autoRequested.current ||
        pro.status !== 'pro' ||
        !nativeAvailable ||
        !appActive.current ||
        document.visibilityState !== 'visible' ||
        !node ||
        guide ||
        settings ||
        contents !== null ||
        featureProOpen ||
        proPreview !== null ||
        closing ||
        ended ||
        recovering ||
        saveError ||
        bookmarks.busy ||
        gestures.zoom !== 100,
      interval: prefs.autoplayInterval,
      speed: prefs.autoplaySpeed,
      top: node?.scrollTop ?? 0,
      limit: Math.max(0, (geometry.at(-1) ?? 0) - (node?.clientHeight ?? 0)),
    });
    if (decision.kind === 'stop') {
      stopAutoplay();
      return false;
    }
    if (decision.kind === 'turn') step(1);
    if (decision.kind === 'scroll' && node) {
      const next = positionAt(geometry, decision.top).page;
      if (errors.has(next)) {
        stopAutoplay();
        setChrome(true);
        return false;
      }
      // 新页没解码出来前停在边界，不滚入空白，也不把等待时间变成跳跃。
      if (!ready(next)) return true;
      node.scrollTop = decision.top;
      syncScroll();
      if (now - lastAutoRecord.current >= 250) {
        controls.current.recordVisible();
        lastAutoRecord.current = now;
      }
      if (decision.end) {
        stopAutoplay();
        setChrome(true);
        return false;
      }
    }
    return true;
  };
  useEffect(() => {
    if (!autoPlaying) return;
    void setNativeKeepAwake(true).catch(stopAutoplay);
    const clock = new AutoplayClock();
    let cancelled = false;
    let frame = 0;
    const tick = (now: number) => {
      if (!cancelled && autoFrame.current(now, clock))
        frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      void setNativeKeepAwake(false).catch(() => undefined);
    };
  }, [autoPlaying]);
  function startAutoplay() {
    if (!canPerform('autoplay.start', pro.status === 'pro')) {
      setSettings(false);
      setFeatureProOpen(true);
      return;
    }
    if (gestures.zoom !== 100 || settingsBusy || closing || ended) return;
    lastAutoRecord.current = 0;
    autoRequested.current = true;
    setSettings(false);
    setChrome(false);
    setAutoPlaying(true);
    stage.current?.focus({ preventScroll: true });
  }
  function reloadSource() {
    stopAutoplay();
    syncScroll();
    controls.current.recordVisible();
    // 重连后先提交最后一个可见位置，再重开书目，避免读到尚未落盘的旧进度。
    void writer
      .flush()
      .then(() => {
        if (mounted.current) onSourceChanged();
      })
      .catch(() => {
        if (mounted.current) {
          setSaveError(true);
          setChrome(true);
        }
      });
  }
  async function leave(next?: Book) {
    if (closing || leaving.current || bookmarks.locked.current) return;
    syncScroll();
    recordVisible();
    leaving.current = true;
    setClosing(true);
    setNextError(false);
    try {
      await writer.flush();
      if (next) {
        await openReading(db, next.id);
        onOpen(next.id);
      } else onBack();
    } catch {
      leaving.current = false;
      if (mounted.current) {
        try {
          await writer.flush();
          setNextError(true);
        } catch {
          setSaveError(true);
        }
        setChrome(true);
      }
    } finally {
      if (mounted.current) setClosing(false);
    }
  }
  async function changePreferences(patch: Partial<ReaderDefaults>) {
    if (settingsBusy) return;
    syncScroll();
    recordVisible();
    setSettingsBusy(true);
    setSettingsError(false);
    try {
      const saved = await saveReaderPreferences(db, reading.book.id, {
        ...patch,
        ...(patch.mode === 'spread' ? { spreadCover: cover } : {}),
      });
      if (!mounted.current) return;
      if (patch.remember !== undefined) {
        await writer.setRemember(patch.remember);
        if (!mounted.current) return;
        setSaveError(false);
      }
      // 先将旧模式的当前位置入队，换模式后由真实 load/可见回调产生新的进度。
      lastRecorded.current = '';
      if (patch.mode === 'scroll') {
        pendingScroll.current = { ...position.current };
      }
      setPrefs((previous) => ({
        ...previous,
        ...patch,
        background: saved.background,
        ...(patch.brightness !== undefined
          ? { brightness: readerBrightness(saved.brightness) }
          : {}),
      }));
      setEnded(false);
    } catch {
      if (mounted.current) setSettingsError(true);
    } finally {
      if (mounted.current) setSettingsBusy(false);
    }
  }
  async function changeCrop(enabled: boolean) {
    if (settingsBusy) return;
    if (enabled && !canPerform('crop.enable', pro.status === 'pro')) {
      // 用户主动开启才出现购买页，并用当前页做裁切前后对比。
      setSettings(false);
      const current = reading.pages[page];
      setProPreview({ before: images.get(page)?.url ?? null, after: null });
      if (!current) return;
      try {
        const after = localPageUrl(
          await archive.renderPage({
            bookId: reading.book.id,
            path: reading.book.path,
            entry: current.entry,
            maxPixel: 1200,
            crop: true,
          }),
        );
        if (mounted.current)
          setProPreview((previous) =>
            previous ? { ...previous, after: after.url } : previous,
          );
      } catch {
        if (mounted.current)
          setProPreview((previous) =>
            previous ? { ...previous, failed: true } : previous,
          );
      }
      return;
    }
    setSettingsBusy(true);
    setSettingsError(false);
    try {
      await saveCropBorders(db, reading.book.id, enabled);
      if (!mounted.current) return;
      setErrors(new Set());
      setCrop(enabled);
    } catch {
      if (mounted.current) setSettingsError(true);
    } finally {
      if (mounted.current) setSettingsBusy(false);
    }
  }
  async function retryPage() {
    if (recovering) return;
    setRecovering(true);
    syncScroll();
    loader.clear();
    loaded.current.clear();
    setImages(new Map());
    setErrors(new Set());
    try {
      await archive.clearCache({ bookId: reading.book.id });
    } catch {
      setErrors(new Set([page]));
    } finally {
      if (mounted.current) {
        setRevision((value) => value + 1);
        setRecovering(false);
      }
    }
  }
  async function retrySave() {
    setClosing(true);
    try {
      await writer.retry();
      if (mounted.current) setSaveError(false);
    } catch {
      if (mounted.current) setSaveError(true);
    } finally {
      if (mounted.current) setClosing(false);
    }
  }
  function currentBookmarkPosition() {
    syncScroll();
    return scroll
      ? { ...position.current }
      : { page: visible[0] ?? page, offset: 0 };
  }
  const bookmarkPage = scroll ? page : (visible[0] ?? page);
  const bookmarkActive = bookmarks.marks.some(
    (mark) => mark.page === bookmarkPage,
  );
  const canBookmark =
    nativeAvailable &&
    bookmarks.state === 'ready' &&
    !ended &&
    !guide &&
    visible.every(ready);
  function toggleCurrentBookmark() {
    if (!canBookmark || closing || contents !== null || settings) return;
    void bookmarks.toggle(currentBookmarkPosition());
  }
  function showContents(tab: 'pages' | 'bookmarks' = 'pages') {
    syncScroll();
    recordVisible();
    setContents(tab);
  }
  function showSettings() {
    syncScroll();
    recordVisible();
    setSettings(true);
  }
  const keyboard = useRef({
    step,
    guide,
    settings,
    contents,
    chrome,
    toggleCurrentBookmark,
  });
  keyboard.current = {
    step,
    guide,
    settings,
    contents,
    chrome,
    toggleCurrentBookmark,
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      stopAutoplay();
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target instanceof HTMLButtonElement &&
          (event.key === ' ' || event.key === 'Enter')) ||
        keyboard.current.guide ||
        keyboard.current.settings ||
        keyboard.current.contents !== null
      )
        return;
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        keyboard.current.toggleCurrentBookmark();
      } else if (
        ['ArrowLeft', 'ArrowRight', ' ', 'PageUp', 'PageDown'].includes(
          event.key,
        )
      ) {
        event.preventDefault();
        keyboard.current.step(
          event.key === 'ArrowLeft'
            ? prefs.direction === 'rtl'
              ? 1
              : -1
            : event.key === 'ArrowRight'
              ? prefs.direction === 'rtl'
                ? -1
                : 1
              : event.key === 'PageUp'
                ? -1
                : 1,
        );
      } else if (event.key === 'Escape' || event.key === 'Enter') {
        event.preventDefault();
        setChrome((value) => !value);
        stage.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [prefs.direction]);
  async function dismissGuide() {
    setGuideBusy(true);
    setGuideError(false);
    try {
      await db.settings.put({ key: 'reader.tap-hint-seen', value: true });
      if (mounted.current) {
        setGuide(false);
        recordVisible(true);
        stage.current?.focus({ preventScroll: true });
      }
    } catch {
      if (mounted.current) setGuideError(true);
    } finally {
      if (mounted.current) setGuideBusy(false);
    }
  }
  const background =
    prefs.background === 'black'
      ? 'dark'
      : prefs.background === 'white'
        ? 'white'
        : 'paper';
  useEffect(() => {
    setStatusBarTone(background === 'dark' ? 'dark' : 'light');
  }, [background]);
  const brightness = readerBrightness(brightnessPreview ?? prefs.brightness);
  const fit = prefs.fit === 'width' ? 'width' : 'page';
  const baseFolioHeight = folioHeight(
    viewportSize.width,
    viewportSize.height,
    visible.map((index) => ratios.get(index) ?? 1.5),
    fit,
  );
  const label =
    visible.length > 1
      ? t(
          '第 {0}–{1} / {2} 页',
          visible[0]! + 1,
          visible.at(-1)! + 1,
          reading.pages.length,
        )
      : t('第 {0} / {1} 页', page + 1, reading.pages.length);
  function renderImage(index: number) {
    const image = images.get(index);
    if (!nativeAvailable || errors.has(index))
      return (
        <PageFailure
          page={index}
          nativeAvailable={nativeAvailable}
          busy={recovering}
          retry={() => void retryPage()}
          skip={
            (prefs.mode === 'spread' ? visible.at(-1)! : index) <
            reading.pages.length - 1
              ? () =>
                  go((prefs.mode === 'spread' ? visible.at(-1)! : index) + 1)
              : undefined
          }
          backLabel={backLabel}
          onBack={() => void leave()}
          source={
            nativeAvailable && reading.book.location === 'inplace'
              ? reading.book
              : undefined
          }
          onSourceChanged={reloadSource}
        />
      );
    if (!image)
      return (
        <p class="reader-loading" role="status">
          {t('正在加载第 {0} 页…', index + 1)}
        </p>
      );
    const key = keyFor(index, image);
    return (
      <span class="reading-artwork" key={key}>
        <img
          class="reader-page-image"
          src={image.url}
          alt={t('第 {0} 页', index + 1)}
          draggable={false}
          onLoad={() => {
            loaded.current.set(index, key);
            setLoadVersion((value) => value + 1);
            // 回调可能来自刚退出窗口的邻页；recordVisible 再核对当前页及显示状态。
            recordVisible();
          }}
          onError={() => {
            loaded.current.delete(index);
            setErrors((previous) => new Set(previous).add(index));
          }}
        />
        <span
          class="reading-image-shade"
          aria-hidden="true"
          style={{ opacity: dimmingOpacity(brightness) }}
        />
      </span>
    );
  }
  const endCard = (
    <section class="reader-end reader-message" aria-label={t('本卷已读完')}>
      <Icon name="check" size={32} />
      <h2>{t(reading.book.unit === '话' ? '这一话读完了' : '这一卷读完了')}</h2>
      <p>
        {reading.book.title} · {volumeLabel(reading.book)}
      </p>
      {nextBook ? (
        <button
          type="button"
          class="reading-next-volume"
          disabled={closing || !ready(reading.pages.length - 1)}
          onClick={() => void leave(nextBook)}
        >
          <BookCover book={nextBook} />
          <span>
            <small>
              {t(nextBook.unit === '话' ? '继续读下一话' : '继续读下一卷')}
            </small>
            <strong>
              {nextBook.title} {volumeLabel(nextBook)}
            </strong>
          </span>
          <Icon name="arrow" />
        </button>
      ) : (
        <p>{t('书架上没有这个系列的下一卷。')}</p>
      )}
      {nextError && (
        <p role="alert">{t('下一卷暂时无法打开，请返回书架检查文件。')}</p>
      )}
      <div>
        <button type="button" disabled={closing} onClick={() => go(0)}>
          {t('从头重读')}
        </button>
        <button
          type="button"
          disabled={closing}
          onClick={() => go(reading.pages.length - 1)}
        >
          {t('返回末页')}
        </button>
        <button type="button" disabled={closing} onClick={() => void leave()}>
          {backLabel}
        </button>
      </div>
    </section>
  );
  const first = Math.min(...requests),
    last = Math.max(...requests);
  return (
    <section
      class="comic-reader"
      onPointerDownCapture={stopAutoplay}
      onKeyDownCapture={stopAutoplay}
      onWheelCapture={stopAutoplay}
      data-background={background}
      data-mode={prefs.mode}
      data-fit={fit}
      aria-label={t('阅读《{0}》', reading.book.title)}
    >
      {autoPlaying && (
        <button
          type="button"
          class="reading-autoplay-stop"
          onClick={stopAutoplay}
        >
          {t('停止自动翻页')}
        </button>
      )}
      <div
        ref={stage}
        class={`reader-canvas ${scroll ? 'is-scroll' : ''} ${fit === 'width' ? 'is-width' : ''}`}
        tabIndex={0}
        role="region"
        aria-label={t('阅读画面，点按中间显示工具栏')}
        aria-keyshortcuts="ArrowLeft ArrowRight Space Escape"
        {...gestures.handlers}
        onScroll={() => {
          if (!scroll) return;
          syncScroll();
          clearTimeout(scrollTimer.current);
          scrollTimer.current = setTimeout(
            () => controls.current.recordVisible(),
            180,
          );
        }}
      >
        {scroll ? (
          <div class="reading-scroll-pages" style={{ width: `${width}px` }}>
            <div
              aria-hidden="true"
              style={{ height: `${geometry[first] ?? 0}px` }}
            />
            {requests
              .slice()
              .sort((a, b) => a - b)
              .map((index) => (
                <div
                  key={index}
                  class="reading-scroll-page"
                  data-reading-page={index}
                  style={{
                    height: `${(geometry[index + 1] ?? 0) - (geometry[index] ?? 0)}px`,
                  }}
                >
                  {renderImage(index)}
                </div>
              ))}
            <div
              aria-hidden="true"
              style={{
                height: `${Math.max(
                  0,
                  (geometry.at(-1) ?? 0) - (geometry[last + 1] ?? 0),
                )}px`,
              }}
            />
            {endCard}
          </div>
        ) : ended ? (
          endCard
        ) : (
          <div
            class="reading-folio"
            style={{
              width: `${gestures.zoom}%`,
              height: `${(baseFolioHeight * gestures.zoom) / 100}px`,
            }}
          >
            {spreadDisplayOrder(visible, prefs.direction).map((index) => (
              <div
                key={index}
                class="reading-folio-page"
                data-reading-page={index}
              >
                {renderImage(index)}
              </div>
            ))}
          </div>
        )}
      </div>
      {chrome && (
        <>
          <header class="reading-topbar">
            <button
              type="button"
              class="reading-back"
              aria-label={backLabel}
              disabled={closing || bookmarks.busy}
              onClick={() => void leave()}
            >
              <Icon name="left" />
              <span>{backLabel}</span>
            </button>
            <div>
              <strong>{reading.book.title}</strong>
              <small>
                {volumeLabel(reading.book)} · {label}
              </small>
            </div>
            <button
              type="button"
              aria-label={t(
                bookmarkActive ? '移除当前页书签' : '添加当前页书签',
              )}
              aria-pressed={bookmarkActive}
              disabled={!canBookmark || bookmarks.busy || closing}
              onClick={toggleCurrentBookmark}
            >
              <Icon name="bookmark" />
            </button>
            <button
              type="button"
              aria-label={t(fullscreen.active ? '退出全屏阅读' : '全屏阅读')}
              aria-pressed={fullscreen.active}
              disabled={fullscreen.busy || closing || guide}
              onClick={() => void fullscreen.toggle()}
            >
              <Icon name="expand" />
            </button>
            <button
              type="button"
              aria-label={t('阅读设置')}
              disabled={closing || guide}
              onClick={showSettings}
            >
              <Icon name="settings" />
            </button>
            <button
              type="button"
              aria-label={t('收起工具栏')}
              onClick={() => {
                setChrome(false);
                stage.current?.focus({ preventScroll: true });
              }}
            >
              <Icon name="close" />
            </button>
          </header>
          <footer class="reading-bottom">
            <div
              class="reading-mode-controls"
              role="group"
              aria-label={t('阅读模式')}
            >
              {(
                [
                  { mode: 'paged', label: '单页' },
                  { mode: 'spread', label: '双页' },
                  { mode: 'scroll', label: '条漫' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  aria-pressed={prefs.mode === item.mode}
                  disabled={settingsBusy || closing || guide}
                  onClick={() => void changePreferences({ mode: item.mode })}
                >
                  {t(item.label)}
                </button>
              ))}
              <button
                type="button"
                class="reading-contents-trigger"
                aria-label={t('目录')}
                disabled={closing || guide}
                onClick={() => showContents()}
              >
                <Icon name="list" />
                <span>{t('目录')}</span>
              </button>
              {!scroll && (
                <button
                  type="button"
                  aria-label={t('放大页面')}
                  disabled={closing || guide || ended}
                  onClick={() => gestures.zoomTo(nextZoom(gestures.zoom))}
                >
                  <Icon name="zoom" />
                  {gestures.zoom}%
                </button>
              )}
            </div>
            {settingsError && !settings && (
              <p role="alert">{t('阅读设置未保存，请重试。')}</p>
            )}
            <div class="reading-page-controls">
              <button
                type="button"
                disabled={(visible[0] === 0 && !ended) || closing || guide}
                onClick={() => step(-1)}
              >
                <Icon name={prefs.direction === 'rtl' ? 'right' : 'left'} />
                {t('上一页')}
              </button>
              <span aria-live="polite">{label}</span>
              <button
                type="button"
                disabled={ended || closing || guide}
                onClick={() => step(1)}
              >
                {t('下一页')}
                <Icon name={prefs.direction === 'rtl' ? 'left' : 'right'} />
              </button>
            </div>
            <input
              class="reading-progress"
              type="range"
              aria-label={t('阅读进度')}
              aria-valuetext={label}
              min={0}
              max={Math.max(0, reading.pages.length - 1)}
              value={page}
              dir={prefs.direction}
              disabled={closing || guide}
              onInput={(event) => go(Number(event.currentTarget.value))}
            />
            <div class="reading-status">
              <span>
                {t(prefs.direction === 'rtl' ? '从右向左' : '从左向右')}
              </span>
              <span>
                {t(
                  prefs.remember === false
                    ? '本次不保存进度'
                    : '阅读进度自动保存',
                )}
              </span>
            </div>
            {fullscreen.error && (
              <p class="reading-fullscreen-error" role="alert">
                {t('当前窗口无法切换全屏，可以继续正常阅读。')}
              </p>
            )}
          </footer>
        </>
      )}
      {saveError && (
        <div class="reading-save-error" role="alert">
          <p>{t('阅读位置暂未保存，请重试。')}</p>
          <div>
            <button
              type="button"
              disabled={closing}
              onClick={() => void retrySave()}
            >
              {t('重试保存')}
            </button>
            <button
              type="button"
              disabled={closing}
              onClick={() => {
                leaving.current = true;
                onBack();
              }}
            >
              {t('不保存并返回')}
            </button>
          </div>
        </div>
      )}
      {bookmarks.error && contents === null && (
        <div class="reading-bookmark-error" role="alert">
          <p>{t('书签操作未保存，请重试。')}</p>
          <button
            type="button"
            disabled={bookmarks.busy}
            onClick={() => void bookmarks.retryMutation()}
          >
            {t('重试书签操作')}
          </button>
        </div>
      )}
      {contents !== null && (
        <ReaderContents
          book={reading.book}
          pages={reading.pages}
          page={page}
          visible={visible}
          bookmarks={bookmarks}
          initialTab={contents}
          onClose={() => setContents(null)}
          onPick={(target) => go(target.page, target.offset)}
        />
      )}
      {settings && (
        <LibraryDialog
          title={t('阅读设置')}
          busy={settingsBusy}
          onClose={() => {
            setBrightnessPreview(null);
            setSettings(false);
          }}
        >
          <div class="reading-settings">
            {nativeAvailable && (
              <RelinkSource book={reading.book} onRelink={reloadSource} />
            )}
            {(pro.status === 'pro' || proEntryVisible(pro.environment)) && (
              <fieldset disabled={settingsBusy}>
                <legend>{t('自动翻页')} · Pro</legend>
                <p>
                  {t(
                    '单页和双页按间隔翻页，条漫匀速滚动。触摸、打开菜单或切到后台会停止，不自动进入下一卷。',
                  )}
                </p>
                <p>{t('播放期间保持屏幕常亮，停止后恢复系统自动锁屏。')}</p>
                <label class="reading-autoplay-option">
                  <span>
                    {t('翻页间隔')} ·{' '}
                    {t('{0} 秒', autoplayInterval(prefs.autoplayInterval))}
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={60}
                    step={1}
                    value={autoplayInterval(prefs.autoplayInterval)}
                    aria-label={t('翻页间隔')}
                    onChange={(event) =>
                      void changePreferences({
                        autoplayInterval: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
                <div class="reading-autoplay-presets">
                  {[2, 5, 10, 30].map((seconds) => (
                    <button
                      type="button"
                      aria-pressed={
                        autoplayInterval(prefs.autoplayInterval) === seconds
                      }
                      onClick={() =>
                        void changePreferences({ autoplayInterval: seconds })
                      }
                    >
                      {t('{0} 秒', seconds)}
                    </button>
                  ))}
                </div>
                <label class="reading-autoplay-option">
                  <span>
                    {t('滚动速度')} · {autoplaySpeed(prefs.autoplaySpeed) / 40}×
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={160}
                    step={10}
                    value={autoplaySpeed(prefs.autoplaySpeed)}
                    aria-label={t('滚动速度')}
                    onChange={(event) =>
                      void changePreferences({
                        autoplaySpeed: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
                <div class="reading-autoplay-presets">
                  {[20, 40, 80, 160].map((speed) => (
                    <button
                      type="button"
                      aria-pressed={
                        autoplaySpeed(prefs.autoplaySpeed) === speed
                      }
                      onClick={() =>
                        void changePreferences({ autoplaySpeed: speed })
                      }
                    >
                      {speed / 40}×
                    </button>
                  ))}
                </div>
                {gestures.zoom !== 100 && (
                  <p>{t('请先将页面缩放还原为 100%。')}</p>
                )}
                <button
                  type="button"
                  disabled={gestures.zoom !== 100 || closing || ended}
                  onClick={startAutoplay}
                >
                  {t('开始自动翻页')}
                </button>
              </fieldset>
            )}
            <label class="reading-remember">
              <span>
                <strong>{t('记住阅读位置')}</strong>
                <small>
                  {t(
                    prefs.remember === false
                      ? '本次不更新进度，保留以前的位置'
                      : '下次打开，从上次停下的地方继续',
                  )}
                </small>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={t('记住阅读位置')}
                checked={prefs.remember !== false}
                disabled={settingsBusy}
                onChange={(event) =>
                  void changePreferences({
                    remember: event.currentTarget.checked,
                  })
                }
              />
            </label>
            {(crop ||
              pro.status === 'pro' ||
              proEntryVisible(pro.environment)) && (
              <label class="reading-remember">
                <span>
                  <strong>
                    {t('自动裁白边')}
                    <em class="reading-pro-tag">Pro</em>
                  </strong>
                  <small>
                    {t(
                      crop && pro.status !== 'pro'
                        ? '需要微光 Pro，目前按原图显示'
                        : '去掉扫描版四周的白边和黑边，只对这本书生效',
                    )}
                  </small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label={t('自动裁白边')}
                  checked={crop}
                  disabled={settingsBusy}
                  onChange={(event) => {
                    const enabled = event.currentTarget.checked;
                    // 需要购买时保持原状态，购买页关闭后由用户再决定。
                    event.currentTarget.checked = crop;
                    void changeCrop(enabled);
                  }}
                />
              </label>
            )}
            <fieldset disabled={settingsBusy}>
              <legend>{t('页面适应')}</legend>
              {(
                [
                  { fit: 'page', label: '完整显示' },
                  { fit: 'width', label: '适应宽度' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  aria-pressed={fit === item.fit}
                  onClick={() => void changePreferences({ fit: item.fit })}
                >
                  {t(item.label)}
                </button>
              ))}
            </fieldset>
            <label class="reading-brightness">
              <span>
                {t('阅读亮度')} {brightness}%
              </span>
              <input
                type="range"
                min={30}
                max={100}
                value={brightness}
                disabled={settingsBusy}
                aria-label={t('阅读亮度')}
                aria-valuetext={t('亮度 {0}%', brightness)}
                onInput={(event) =>
                  setBrightnessPreview(
                    readerBrightness(Number(event.currentTarget.value)),
                  )
                }
                onChange={(event) => {
                  const value = Number(event.currentTarget.value);
                  void changePreferences({ brightness: value }).finally(() =>
                    setBrightnessPreview(null),
                  );
                }}
              />
            </label>
            <fieldset disabled={settingsBusy}>
              <legend>{t('翻页方向')}</legend>
              {(
                [
                  { direction: 'ltr', label: '从左向右' },
                  { direction: 'rtl', label: '从右向左' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  aria-pressed={prefs.direction === item.direction}
                  onClick={() =>
                    void changePreferences({ direction: item.direction })
                  }
                >
                  {t(item.label)}
                </button>
              ))}
            </fieldset>
            <fieldset disabled={settingsBusy}>
              <legend>{t('双页封面')}</legend>
              {(
                [
                  { spreadCover: 'alone', label: '封面单独显示' },
                  { spreadCover: 'paired', label: '封面与第二页拼合' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  aria-pressed={cover === item.spreadCover}
                  onClick={() =>
                    void changePreferences({ spreadCover: item.spreadCover })
                  }
                >
                  {t(item.label)}
                </button>
              ))}
            </fieldset>
            <fieldset disabled={settingsBusy}>
              <legend>{t('阅读背景')}</legend>
              {(
                [
                  { background: 'system', label: '暖纸' },
                  { background: 'white', label: '纯白' },
                  { background: 'black', label: '深色' },
                ] as const
              ).map((item) => (
                <button
                  type="button"
                  aria-pressed={prefs.background === item.background}
                  onClick={() =>
                    void changePreferences({ background: item.background })
                  }
                >
                  {t(item.label)}
                </button>
              ))}
            </fieldset>
            {settingsError && (
              <p role="alert">{t('阅读设置未保存，请重试。')}</p>
            )}
          </div>
        </LibraryDialog>
      )}
      {proPreview && (
        <ProDialog
          preview={proPreview}
          onClose={() => {
            setProPreview(null);
            // 在购买页完成购买后，直接为这本书开启。
            if (proStore().state.value.status === 'pro') void changeCrop(true);
          }}
        />
      )}
      {featureProOpen && <ProDialog onClose={() => setFeatureProOpen(false)} />}
      {guide && (
        <ReaderGuide
          scroll={scroll}
          direction={prefs.direction}
          busy={guideBusy}
          error={guideError}
          backLabel={backLabel}
          onDismiss={() => void dismissGuide()}
          onBack={() => void leave()}
        />
      )}
    </section>
  );
}

function PageFailure({
  page,
  nativeAvailable,
  busy,
  retry,
  skip,
  backLabel,
  onBack,
  source,
  onSourceChanged,
}: {
  page: number;
  nativeAvailable: boolean;
  busy: boolean;
  retry: () => void;
  skip?: () => void;
  backLabel: string;
  onBack: () => void;
  source?: Book;
  onSourceChanged?: () => void;
}) {
  return (
    <div
      class="reader-message reading-page-failure"
      role="alert"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Icon name="book" size={30} />
      <h2>
        {t(
          nativeAvailable ? '这一页暂时无法显示' : '请在移动端 App 中阅读漫画',
        )}
      </h2>
      <p>
        {t('第 {0} 页', page + 1)} ·{' '}
        {t(
          nativeAvailable
            ? '可重试加载，或跳过这一页继续阅读。'
            : '漫画页面通过设备上的原生接口加载。',
        )}
      </p>
      {source && <RelinkSource book={source} onRelink={onSourceChanged} />}
      <div>
        {nativeAvailable && (
          <button type="button" disabled={busy} onClick={retry}>
            {t('重试加载')}
          </button>
        )}
        {nativeAvailable && skip && (
          <button type="button" onClick={skip}>
            {t('下一页')}
          </button>
        )}
        <button type="button" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </div>
  );
}
function ReaderGuide({
  scroll,
  direction,
  busy,
  error,
  backLabel,
  onDismiss,
  onBack,
}: {
  scroll: boolean;
  direction: 'ltr' | 'rtl';
  busy: boolean;
  error: boolean;
  backLabel: string;
  onDismiss: () => void;
  onBack: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    root.current?.querySelector('button')?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      ref={root}
      class="reading-guide"
      role="dialog"
      aria-modal="true"
      aria-label={t('首次阅读说明')}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const buttons = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            'button:not(:disabled)',
          ),
        ];
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (!buttons.length) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && index <= 0) {
          event.preventDefault();
          buttons.at(-1)?.focus();
        } else if (
          !event.shiftKey &&
          (index < 0 || index === buttons.length - 1)
        ) {
          event.preventDefault();
          buttons[0]?.focus();
        }
      }}
    >
      <div class="reading-guide-zones" aria-hidden="true">
        <span>
          {t(scroll ? '向上滑动' : direction === 'rtl' ? '下一页' : '上一页')}
        </span>
        <span>{t('显示工具栏')}</span>
        <span>
          {t(scroll ? '向下滑动' : direction === 'rtl' ? '上一页' : '下一页')}
        </span>
      </div>
      <div class="reader-message">
        <h2>{t('轻点即可阅读')}</h2>
        <p>
          {t(
            scroll
              ? '上下滑动连续阅读，轻点画面呼出工具栏。'
              : '点按左右两侧翻页，中间呼出工具栏或双击放大；双指捏合缩放，放大后拖动画面。',
          )}
        </p>
        <div>
          <button type="button" disabled={busy} onClick={onDismiss}>
            {t('知道了')}
          </button>
          <button type="button" disabled={busy} onClick={onBack}>
            {backLabel}
          </button>
        </div>
        {error && <p role="alert">{t('操作未完成，请重试。')}</p>}
      </div>
    </div>
  );
}
