import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import {
  bookmark,
  bookSeriesKey,
  demoBooks,
  demoState,
  dismissGuide,
  notify,
  openDemoBook,
  preference,
  saveProgress,
  volumeText,
} from '@/app/demo';
import type { DemoBook } from '@/app/demo';
import { DemoComicPage, DemoCover } from '@/components/DemoArtwork';
import {
  DemoDialog,
  DemoPreferencesPanel,
  IconButton,
} from '@/components/DemoDialogs';
import { DemoIcon } from '@/components/DemoIcon';
import {
  buildSpreads,
  spreadAnchor,
  spreadDisplayOrder,
  spreadIndexOf,
} from './spread';
import { tapAction } from './tapZones';

const zoomSteps = [100, 150, 200];
const maxZoom = 300;
const doubleTapMs = 280;
const chapterNames = ['风起的地方', '沿着旧路走', '抵达之前'];

interface Point {
  x: number;
  y: number;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export default function DemoReader({
  book,
  onBack,
}: {
  book: DemoBook;
  onBack: () => void;
}) {
  const [page, setPage] = useState(
    demoState.value.progress[book.id]?.page ?? 0,
  );
  const [chrome, setChrome] = useState(false);
  const [ended, setEnded] = useState(false);
  const [dialog, setDialog] = useState<'contents' | 'settings' | null>(null);
  const [contentsTab, setContentsTab] = useState<'chapters' | 'bookmarks'>(
    'chapters',
  );
  const [zoom, setZoom] = useState(100);
  const viewport = useRef<HTMLDivElement>(null);
  const current = useRef(page);
  const endedRef = useRef(false);
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<(Point & { pinched: boolean }) | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const lastTap = useRef<(Point & { time: number }) | null>(null);
  const menuTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const zoomFocus = useRef<{
    fx: number;
    fy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const prefs = demoState.value.preferences;
  const guideSeen = demoState.value.guideSeen;
  const rtl = prefs.direction === 'rtl';
  const scroll = prefs.mode === 'scroll';
  const marks = demoState.value.bookmarks[book.id] ?? [];
  // 本地图片画册没有包内子文件夹，不虚构章节；演示画册模拟按子文件夹分章。
  const hasChapters = book.cover === 'designed' && !book.images;
  const chapter = Math.floor(page / 4);
  const spreads = useMemo(
    () => buildSpreads(book.pages, prefs.spreadCover),
    [book.pages, prefs.spreadCover],
  );
  const visiblePages =
    prefs.mode === 'spread'
      ? (spreads[spreadIndexOf(spreads, page)] ?? [page])
      : [page];
  const lastVisible = Math.max(...visiblePages);
  const atStart =
    prefs.mode === 'spread' ? spreadIndexOf(spreads, page) === 0 : page === 0;
  const series = bookSeriesKey(book);
  const nextBook =
    book.volume === null
      ? undefined
      : demoBooks.value
          .filter(
            (item) =>
              bookSeriesKey(item) === series &&
              item.volume !== null &&
              item.volume > book.volume!,
          )
          .sort((a, b) => a.volume! - b.volume!)[0];

  function markEnded(value: boolean) {
    endedRef.current = value;
    setEnded(value);
  }
  function go(index: number) {
    let next = Math.min(book.pages - 1, Math.max(0, index));
    if (prefs.mode === 'spread') {
      const spread = spreads[spreadIndexOf(spreads, next)];
      if (spread) next = spreadAnchor(spread, book.pages);
    }
    current.current = next;
    setPage(next);
    markEnded(false);
    setZoom(100);
    saveProgress(book, next);
    if (scroll)
      viewport.current
        ?.querySelector(`[data-demo-page="${next}"]`)
        ?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function finish() {
    current.current = book.pages - 1;
    setPage(book.pages - 1);
    setZoom(100);
    saveProgress(book, book.pages - 1);
    if (scroll)
      viewport.current
        ?.querySelector('.reader-end')
        ?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    else markEnded(true);
  }
  function step(delta: number) {
    if (endedRef.current) {
      if (delta < 0) markEnded(false);
      return;
    }
    if (prefs.mode === 'spread') {
      const target = spreadIndexOf(spreads, current.current) + delta;
      if (target >= spreads.length) finish();
      else go(spreads[Math.max(0, target)]?.[0] ?? 0);
      return;
    }
    const target = current.current + delta;
    if (target >= book.pages) finish();
    else go(target);
  }
  function zoomTo(value: number, point?: Point) {
    const stage = viewport.current;
    if (stage && point) {
      const rect = stage.getBoundingClientRect();
      const ox = point.x - rect.left;
      const oy = point.y - rect.top;
      zoomFocus.current = {
        fx: (stage.scrollLeft + ox) / Math.max(1, stage.scrollWidth),
        fy: (stage.scrollTop + oy) / Math.max(1, stage.scrollHeight),
        ox,
        oy,
      };
    }
    setZoom(Math.round(Math.min(maxZoom, Math.max(100, value))));
  }
  function tap(event: PointerEvent) {
    const stage = viewport.current;
    if (!stage) return;
    // 工具栏显示时，轻点画面任意处只收起工具栏，避免误翻页。
    if (chrome) {
      setChrome(false);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const action = tapAction(
      (event.clientX - rect.left) / rect.width,
      prefs.direction,
      scroll,
    );
    if (action !== 'menu') {
      lastTap.current = null;
      step(action === 'next' ? 1 : -1);
      return;
    }
    const now = performance.now();
    const point = { x: event.clientX, y: event.clientY };
    const previous = lastTap.current;
    if (
      !scroll &&
      !endedRef.current &&
      previous &&
      now - previous.time < doubleTapMs &&
      distance(previous, point) < 30
    ) {
      clearTimeout(menuTimer.current);
      lastTap.current = null;
      zoomTo(zoom > 100 ? 100 : 200, point);
      return;
    }
    lastTap.current = { ...point, time: now };
    clearTimeout(menuTimer.current);
    // 中间区域等待可能的双击，再呼出工具栏；条漫没有双击放大，立即响应。
    menuTimer.current = setTimeout(
      () => setChrome(true),
      scroll || endedRef.current ? 0 : doubleTapMs,
    );
  }

  const latest = useRef({ step, chrome, onBack, page });
  latest.current = { step, chrome, onBack, page };
  useEffect(() => {
    saveProgress(book, current.current);
    return () => clearTimeout(menuTimer.current);
  }, [book]);
  useEffect(() => {
    markEnded(false);
    setZoom(100);
  }, [prefs.mode]);
  useLayoutEffect(() => {
    const focus = zoomFocus.current;
    const stage = viewport.current;
    zoomFocus.current = null;
    if (!focus || !stage) return;
    stage.scrollLeft = focus.fx * stage.scrollWidth - focus.ox;
    stage.scrollTop = focus.fy * stage.scrollHeight - focus.oy;
  }, [zoom]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        document.querySelector('dialog[open]') ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      const { step: move, chrome: shown, onBack: back } = latest.current;
      const reverse = demoState.value.preferences.direction === 'rtl';
      if (
        event.key === 'ArrowRight' ||
        event.key === 'PageDown' ||
        (event.key === ' ' && !(event.target instanceof HTMLButtonElement))
      ) {
        event.preventDefault();
        move(event.key === 'ArrowRight' && reverse ? -1 : 1);
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        move(event.key === 'ArrowLeft' && reverse ? 1 : -1);
      }
      if (event.key === 'Escape') {
        if (!shown) setChrome(true);
        else back();
      }
      if (event.key.toLowerCase() === 'b')
        bookmark(book.id, latest.current.page);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [book]);
  useEffect(() => {
    if (!scroll || !viewport.current) return;
    const root = viewport.current;
    root
      .querySelector(`[data-demo-page="${current.current}"]`)
      ?.scrollIntoView({ block: 'start' });
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(
                a.boundingClientRect.top - root.getBoundingClientRect().top,
              ) -
              Math.abs(
                b.boundingClientRect.top - root.getBoundingClientRect().top,
              ),
          )[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.demoPage);
        if (index !== current.current) {
          current.current = index;
          setPage(index);
          saveProgress(book, index);
        }
      },
      { root, rootMargin: '-15% 0px -65% 0px' },
    );
    root
      .querySelectorAll('[data-demo-page]')
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [scroll, book]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify('当前窗口不支持全屏，可以继续正常阅读');
    }
  }

  const endCard = (
    <section class="reader-end" aria-label="本卷已读完">
      <span class="page-eyebrow">
        {volumeText(book) || book.title} · {book.pages} 页
      </span>
      <h2>本{book.unit}读完了</h2>
      {nextBook ? (
        <button class="reader-end-next" onClick={() => openDemoBook(nextBook)}>
          <span class="reader-end-cover">
            <DemoCover book={nextBook} small />
          </span>
          <span>
            <small>继续读下一{nextBook.unit}</small>
            <strong>
              {nextBook.title} {volumeText(nextBook)}
            </strong>
          </span>
          <DemoIcon name="arrow" />
        </button>
      ) : (
        <p>书架上没有这个系列的下一卷。</p>
      )}
      <div class="reader-end-actions">
        <button class="demo-secondary" onClick={onBack}>
          回到书架
        </button>
        <button class="demo-secondary" onClick={() => go(0)}>
          从头再读
        </button>
      </div>
    </section>
  );

  return (
    <main
      class={`demo-reader mode-${prefs.mode} reader-bg-${prefs.background} ${chrome ? '' : 'chrome-hidden'} fit-${prefs.fit}`}
    >
      <header class="reader-topbar">
        <div class="reader-book-heading">
          <button class="reader-back" aria-label="返回书架" onClick={onBack}>
            <DemoIcon name="left" />
            <span>书架</span>
          </button>
          <span class="reader-title-divider" />
          <div>
            <strong>
              {book.title}
              <span>{volumeText(book)}</span>
            </strong>
            <small>
              {hasChapters
                ? chapterNames[chapter]
                : book.images
                  ? `${book.pages} 张图片`
                  : book.fileName}
            </small>
          </div>
        </div>
        <div class="reader-mode-switch" aria-label="阅读模式">
          {(
            [
              { mode: 'paged', label: '单页' },
              { mode: 'scroll', label: '条漫' },
              { mode: 'spread', label: '双页' },
            ] as const
          ).map((item) => (
            <button
              class={prefs.mode === item.mode ? 'selected' : ''}
              aria-pressed={prefs.mode === item.mode}
              onClick={() => preference({ mode: item.mode })}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div class="reader-top-actions">
          <IconButton
            icon="bookmark"
            label={marks.includes(page) ? '移除当前页书签' : '收藏当前页书签'}
            active={marks.includes(page)}
            onClick={() => bookmark(book.id, page)}
          />
          <IconButton
            icon="expand"
            label="切换全屏阅读"
            onClick={() => void fullscreen()}
          />
          <IconButton
            icon="settings"
            label="阅读设置"
            onClick={() => setDialog('settings')}
          />
        </div>
      </header>
      <div
        ref={viewport}
        class={`reader-stage ${zoom > 100 ? 'is-zoomed' : ''}`}
        onPointerDown={(event) => {
          const point = { x: event.clientX, y: event.clientY };
          pointers.current.set(event.pointerId, point);
          if (pointers.current.size === 1)
            gesture.current = { ...point, pinched: false };
          if (pointers.current.size === 2 && !scroll && !ended) {
            const [a, b] = [...pointers.current.values()];
            pinch.current = { distance: distance(a!, b!), zoom };
            if (gesture.current) gesture.current.pinched = true;
          }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          const start = pinch.current;
          if (!start || pointers.current.size !== 2 || start.distance <= 0)
            return;
          const [a, b] = [...pointers.current.values()];
          zoomTo((start.zoom * distance(a!, b!)) / start.distance, {
            x: (a!.x + b!.x) / 2,
            y: (a!.y + b!.y) / 2,
          });
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (!pointers.current.size) gesture.current = null;
        }}
        onPointerUp={(event) => {
          pointers.current.delete(event.pointerId);
          if (pointers.current.size < 2) pinch.current = null;
          if (pointers.current.size) return;
          const start = gesture.current;
          gesture.current = null;
          if (
            !start ||
            start.pinched ||
            (event.target instanceof Element && event.target.closest('button'))
          )
            return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (
            Math.abs(dx) > 55 &&
            Math.abs(dx) > Math.abs(dy) &&
            !scroll &&
            zoom <= 100
          )
            step((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
          else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) tap(event);
        }}
      >
        {scroll ? (
          <div class="reader-scroll-pages">
            {Array.from({ length: book.pages }, (_, index) => (
              <div
                class="reader-scroll-page"
                key={index}
                data-demo-page={index}
              >
                <DemoComicPage book={book} page={index} />
              </div>
            ))}
            {endCard}
          </div>
        ) : ended ? (
          endCard
        ) : (
          <div
            class={`reader-folio ${zoom > 100 ? 'is-zoomed' : ''} ${visiblePages.length > 1 ? 'is-pair' : ''}`}
            style={{ '--reader-zoom': zoom / 100 }}
          >
            {spreadDisplayOrder(visiblePages, prefs.direction).map((index) => (
              <div class="reader-page" key={index}>
                <DemoComicPage book={book} page={index} />
              </div>
            ))}
          </div>
        )}
        <div
          class="reader-dimming"
          style={{ opacity: (100 - prefs.brightness) / 140 }}
        />
      </div>
      {!scroll && (
        <>
          <button
            class="reader-edge reader-edge-left"
            aria-label={rtl ? '下一页' : '上一页'}
            disabled={rtl ? ended : atStart && !ended}
            onClick={() => step(rtl ? 1 : -1)}
          >
            <DemoIcon name="left" size={23} />
          </button>
          <button
            class="reader-edge reader-edge-right"
            aria-label={rtl ? '上一页' : '下一页'}
            disabled={rtl ? atStart && !ended : ended}
            onClick={() => step(rtl ? -1 : 1)}
          >
            <DemoIcon name="right" size={23} />
          </button>
        </>
      )}
      {!guideSeen && (
        <button
          type="button"
          class={`reader-guide ${scroll ? 'is-scroll' : ''}`}
          aria-label="知道了，开始阅读"
          onClick={dismissGuide}
        >
          {scroll ? (
            <span class="guide-zone is-center">
              <b>菜单</b>轻点画面
            </span>
          ) : (
            <>
              <span class="guide-zone">
                <b>{rtl ? '下一页' : '上一页'}</b>点左侧
              </span>
              <span class="guide-zone is-center">
                <b>菜单</b>点中间 · 双击放大
              </span>
              <span class="guide-zone">
                <b>{rtl ? '上一页' : '下一页'}</b>点右侧
              </span>
            </>
          )}
          <span class="guide-dismiss">知道了</span>
        </button>
      )}
      <footer class="reader-bottom">
        <div class="reader-progress-heading">
          <button
            class="reader-contents"
            onClick={() => {
              setContentsTab('chapters');
              setDialog('contents');
            }}
          >
            <DemoIcon name="list" size={19} />
            <span>目录</span>
          </button>
          <span class="reader-page-indicator">
            <b>{visiblePages.map((index) => index + 1).join('–')}</b>
            <span>/</span>
            {book.pages}
            <small>{Math.round(((lastVisible + 1) / book.pages) * 100)}%</small>
          </span>
          {scroll ? (
            <span class="reader-zoom" />
          ) : (
            <button
              class="reader-zoom"
              aria-label="放大页面"
              onClick={() =>
                zoomTo(zoomSteps.find((value) => value > zoom) ?? 100)
              }
            >
              <DemoIcon name="zoom" size={18} />
              <span>{zoom}%</span>
            </button>
          )}
        </div>
        <input
          class="reader-progress-range"
          type="range"
          dir={rtl ? 'rtl' : 'ltr'}
          aria-label="阅读页码"
          min="0"
          max={book.pages - 1}
          value={page}
          style={{
            '--read-percent': `${(page / Math.max(1, book.pages - 1)) * 100}%`,
          }}
          onInput={(event) => go(Number(event.currentTarget.value))}
        />
        <div class="reader-bottom-caption">
          <span>{rtl ? '从右向左翻页' : '从左向右翻页'}</span>
          <span class="reader-save-note">
            <i />
            {prefs.remember ? '阅读进度已记住' : '本次不保存进度'}
          </span>
        </div>
      </footer>
      {dialog === 'settings' && (
        <DemoDialog
          title="阅读设置"
          subtitle="调整后立即生效"
          onClose={() => setDialog(null)}
        >
          <DemoPreferencesPanel reader />
        </DemoDialog>
      )}
      {dialog === 'contents' && (
        <DemoDialog
          title={book.title}
          subtitle={`${volumeText(book) || book.fileName} · 共 ${book.pages} 页`}
          onClose={() => setDialog(null)}
          wide
        >
          <div class="contents-tabs">
            <button
              class={contentsTab === 'chapters' ? 'selected' : ''}
              onClick={() => setContentsTab('chapters')}
            >
              {hasChapters ? '章节目录' : '全部页面'}
            </button>
            <button
              class={contentsTab === 'bookmarks' ? 'selected' : ''}
              onClick={() => setContentsTab('bookmarks')}
            >
              我的书签 <span>{marks.length}</span>
            </button>
          </div>
          {contentsTab === 'chapters' ? (
            <>
              {hasChapters && (
                <>
                  <div class="chapter-list">
                    {Array.from(
                      { length: Math.ceil(book.pages / 4) },
                      (_, index) => (
                        <button
                          class={chapter === index ? 'selected' : ''}
                          onClick={() => {
                            go(index * 4);
                            setDialog(null);
                          }}
                        >
                          <span>{String(index + 1).padStart(2, '0')}</span>
                          <strong>{chapterNames[index]}</strong>
                          <small>第 {index * 4 + 1} 页</small>
                          <DemoIcon
                            name={chapter === index ? 'book' : 'right'}
                            size={17}
                          />
                        </button>
                      ),
                    )}
                  </div>
                  <p class="contents-label">快速跳页</p>
                </>
              )}
              <div class="page-thumbnails">
                {Array.from({ length: book.pages }, (_, index) => (
                  <button
                    class={visiblePages.includes(index) ? 'selected' : ''}
                    aria-label={`跳到第 ${index + 1} 页`}
                    onClick={() => {
                      go(index);
                      setDialog(null);
                    }}
                  >
                    <DemoComicPage book={book} page={index} />
                    <span>{index + 1}</span>
                  </button>
                ))}
              </div>
            </>
          ) : marks.length ? (
            <div class="bookmark-list">
              {marks.map((index) => (
                <div key={index}>
                  <button
                    onClick={() => {
                      go(index);
                      setDialog(null);
                    }}
                  >
                    <span class="bookmark-mini">
                      <DemoComicPage book={book} page={index} />
                    </span>
                    <span>
                      <strong>第 {index + 1} 页</strong>
                      <small>
                        {hasChapters
                          ? chapterNames[Math.floor(index / 4)]
                          : '本地图片画册'}
                      </small>
                    </span>
                    <DemoIcon name="arrow" size={18} />
                  </button>
                  <IconButton
                    icon="close"
                    label={`移除第 ${index + 1} 页书签`}
                    onClick={() => bookmark(book.id, index)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div class="demo-empty compact">
              <DemoIcon name="bookmark" size={32} />
              <h3>还没有书签</h3>
              <p>阅读时点右上角的书签图标，或按 B 键。</p>
            </div>
          )}
        </DemoDialog>
      )}
    </main>
  );
}
