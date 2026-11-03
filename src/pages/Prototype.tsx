import { useEffect, useRef, useState } from 'preact/hooks';
import { pageList } from '@/archive/pageList';
import type { ComicPage, LegacyEncoding } from '@/archive/pageList';
import { ComicArchive } from '@/native/comicArchive';
import type { RenderedPage } from '@/native/comicArchive';
import { ComicPrototype, supportsPrototype } from '@/native/comicPrototype';
import type { PrototypeBook } from '@/native/comicPrototype';
import { PrototypePageLoader } from '@/reader/PrototypePageLoader';
import { centerBandRootMargin } from '@/reader/viewportBand';
import '@/styles/prototype.css';

interface Reading {
  book: PrototypeBook;
  pages: ComicPage[];
  started: number;
}
type Metric = { label: string; ms: number };
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function PrototypeReader({
  reading,
  onClose,
  onMetric,
}: {
  reading: Reading;
  onClose: () => void;
  onMetric: (metric: Metric) => void;
}) {
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<'paged' | 'scroll'>('paged');
  const [images, setImages] = useState<Map<number, RenderedPage>>(new Map());
  const [errors, setErrors] = useState<Map<number, string>>(new Map());
  const [recovering, setRecovering] = useState(false);
  const loader = useRef(new PrototypePageLoader(reading.book, reading.pages));
  const viewport = useRef<HTMLDivElement>(null);
  const ratios = useRef(new Map<number, number>());
  const first = useRef(true);
  const navigation = useRef<{ page: number; started: number } | null>(null);
  const frameTimes = useRef<number[]>([]);
  const [frames, setFrames] = useState<string>('');

  useEffect(() => () => loader.current.dispose(), []);
  useEffect(() => {
    if (recovering) return;
    const active = loader.current;
    const version = active.move(page);
    let cancelled = false;
    const neighbors = [page, page + 1, page - 1].filter(
      (index) => reading.pages[index],
    );
    setImages(
      new Map(
        neighbors.flatMap((index) => {
          const value = active.get(index);
          return value ? [[index, value] as const] : [];
        }),
      ),
    );
    void (async () => {
      for (const index of neighbors) {
        try {
          const rendered = await active.load(index, 8192, version);
          if (cancelled) return;
          if (rendered) {
            ratios.current.set(
              index,
              rendered.sourceWidth / rendered.sourceHeight,
            );
            setImages((previous) => new Map(previous).set(index, rendered));
            setErrors((previous) => {
              const next = new Map(previous);
              next.delete(index);
              return next;
            });
          }
        } catch (error) {
          if (!cancelled)
            setErrors((previous) =>
              new Map(previous).set(index, message(error)),
            );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, recovering, reading]);

  useEffect(() => {
    if (mode !== 'scroll' || !viewport.current) return;
    const root = viewport.current;
    // 视口中线决定当前页，长条漫不会因为只露出一小部分就提前跳到下一页。
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting)
              setPage(Number((entry.target as HTMLElement).dataset.page));
          }
        },
        { root, rootMargin: centerBandRootMargin(root.clientHeight) },
      );
      root
        .querySelectorAll('[data-page]')
        .forEach((element) => observer?.observe(element));
    };
    observe();
    const resize = new ResizeObserver(observe);
    resize.observe(root);
    root
      .querySelector(`[data-page="${page}"]`)
      ?.scrollIntoView({ block: 'start' });
    return () => {
      observer?.disconnect();
      resize.disconnect();
    };
    // 切换模式时定位一次，普通滚动由观察器追踪。
  }, [mode, reading]);

  useEffect(() => {
    let id = 0;
    let last = 0;
    const measure = (now: number) => {
      if (last && document.visibilityState === 'visible') {
        frameTimes.current.push(now - last);
        if (frameTimes.current.length > 600) frameTimes.current.shift();
      }
      last = now;
      id = requestAnimationFrame(measure);
    };
    id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, []);

  function go(index: number) {
    if (
      recovering ||
      index < 0 ||
      index >= reading.pages.length ||
      index === page
    )
      return;
    navigation.current = { page: index, started: performance.now() };
    if (mode === 'scroll')
      viewport.current
        ?.querySelector(`[data-page="${index}"]`)
        ?.scrollIntoView({ block: 'start' });
    setPage(index);
  }

  async function recover(index: number) {
    if (recovering) return;
    setRecovering(true);
    loader.current.clear();
    setImages(new Map());
    setErrors(new Map());
    try {
      await ComicArchive.clearCache({ bookId: reading.book.bookId });
    } catch (error) {
      setErrors(new Map([[index, message(error)]]));
    } finally {
      setRecovering(false);
    }
  }

  function loaded(index: number) {
    if (index !== page) return;
    // load 之后再等两帧，覆盖图片挂载到下一次绘制机会的时间；不是 Instruments 的呈现时刻。
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (first.current && index === 0) {
          first.current = false;
          onMetric({
            label: '打开至首图（不含复制）',
            ms: performance.now() - reading.started,
          });
        }
        const value = navigation.current;
        if (value?.page === index) {
          navigation.current = null;
          onMetric({
            label: `翻至第 ${index + 1} 页`,
            ms: performance.now() - value.started,
          });
        }
      }),
    );
  }

  function renderImage(index: number) {
    const image = images.get(index);
    const error = errors.get(index);
    return error ? (
      <div class="prototype-page-error" role="alert">
        <p>
          第 {index + 1} 页：{error}
        </p>
        <button
          type="button"
          disabled={recovering}
          onClick={() => void recover(index)}
        >
          重试此页
        </button>
      </div>
    ) : image ? (
      <img
        key={`${index}-${image.url}`}
        src={image.url}
        width={image.width}
        height={image.height}
        alt={`第 ${index + 1} 页`}
        decoding="async"
        onLoad={() => loaded(index)}
        onError={() =>
          setErrors((previous) =>
            new Map(previous).set(
              index,
              '页面缓存加载失败，请返回后重新打开。',
            ),
          )
        }
      />
    ) : (
      <p class="prototype-page-loading" role="status">
        正在准备第 {index + 1} 页…
      </p>
    );
  }

  return (
    <main class="prototype-reader">
      <header class="prototype-toolbar">
        <button type="button" disabled={recovering} onClick={onClose}>
          返回
        </button>
        <span class="prototype-book-title">{reading.book.name}</span>
        <button
          type="button"
          disabled={recovering}
          onClick={() => {
            setMode((value) => (value === 'paged' ? 'scroll' : 'paged'));
          }}
        >
          切换{mode === 'paged' ? '条漫' : '翻页'}
        </button>
      </header>
      <div
        ref={viewport}
        class={`prototype-viewport ${mode}`}
        tabIndex={0}
        aria-label="漫画阅读区"
        onKeyDown={(event) => {
          if (mode !== 'paged') return;
          if (event.key === 'ArrowRight') go(page + 1);
          if (event.key === 'ArrowLeft') go(page - 1);
        }}
      >
        {mode === 'paged'
          ? renderImage(page)
          : reading.pages.map((item, index) => (
              <section
                key={item.entry}
                data-page={index}
                aria-label={`第 ${index + 1} 页`}
                style={{
                  aspectRatio: String(ratios.current.get(index) ?? 0.7),
                }}
              >
                {Math.abs(index - page) <= 1 ? renderImage(index) : null}
              </section>
            ))}
      </div>
      <footer class="prototype-toolbar">
        <button
          type="button"
          disabled={recovering || page === 0}
          onClick={() => go(page - 1)}
        >
          上一页
        </button>
        <label class="prototype-jump">
          页码{' '}
          <input
            type="number"
            disabled={recovering}
            inputMode="numeric"
            min={1}
            max={reading.pages.length}
            value={page + 1}
            onChange={(event) => {
              const value = Number(event.currentTarget.value);
              if (Number.isInteger(value)) go(value - 1);
            }}
          />{' '}
          / {reading.pages.length}
        </label>
        <button
          type="button"
          disabled={recovering || page === reading.pages.length - 1}
          onClick={() => go(page + 1)}
        >
          下一页
        </button>
      </footer>
      <details class="prototype-frame-details">
        <summary>帧间隔采样</summary>
        <p>
          连续滚动后查看最近 600 帧。样本含静止帧，不能替代 Instruments
          的滚动帧率。
        </p>
        <button
          type="button"
          onClick={() => {
            frameTimes.current = [];
            setFrames('采样已清空，请连续滚动。');
          }}
        >
          开始采样
        </button>
        <button
          type="button"
          onClick={() => {
            const values = [...frameTimes.current].sort((a, b) => a - b);
            const p95 =
              values[
                Math.min(values.length - 1, Math.floor(values.length * 0.95))
              ];
            setFrames(
              p95 === undefined
                ? '还没有采样'
                : `${values.length} 帧，P95 间隔 ${p95.toFixed(1)} ms`,
            );
          }}
        >
          查看采样
        </button>
        <output>{frames}</output>
      </details>
    </main>
  );
}

export default function Prototype() {
  const [book, setBook] = useState<PrototypeBook | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [encoding, setEncoding] = useState<LegacyEncoding>('gb18030');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(0);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [hash, setHash] = useState('');
  const available = supportsPrototype();
  const addMetric = (metric: Metric) =>
    setMetrics((previous) => [...previous.slice(-29), metric]);

  useEffect(() => {
    if (!available) return;
    const handle = ComicPrototype.addListener('progress', ({ copied, total }) =>
      setCopied(total ? copied / total : 0),
    );
    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, [available]);

  async function open(value: PrototypeBook) {
    const started = performance.now();
    const result = await ComicArchive.inspect({ path: value.path });
    if (result.encrypted)
      throw new Error('暂不支持加密 ZIP，请选择未加密的文件。');
    const pages = pageList(result.entries, encoding);
    if (!pages.length) throw new Error('压缩包内没有可读取的图片。');
    setReading({ book: value, pages, started });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  if (reading)
    return (
      <PrototypeReader
        key={reading.started}
        reading={reading}
        onClose={() => setReading(null)}
        onMetric={addMetric}
      />
    );

  return (
    <main class="prototype-home">
      <header>
        <p class="prototype-eyebrow">微光漫卷 · M0-05</p>
        <h1>iOS 性能原型</h1>
      </header>
      <p>
        选择自己的 ZIP /
        CBZ，验证大包随机读页与长条漫。副本仅供这一批测试，尚未接入正式书架。
      </p>
      {!available && (
        <p role="status">
          请在 Xcode 的 Debug
          构建中运行。桌面浏览器和正式构建不提供原生文件读取。
        </p>
      )}
      <label class="prototype-encoding">
        旧文件名编码
        <select
          value={encoding}
          disabled={busy}
          onChange={(event) =>
            setEncoding(event.currentTarget.value as LegacyEncoding)
          }
        >
          <option value="gb18030">简体中文 GBK / GB18030</option>
          <option value="big5">繁体中文 Big5</option>
          <option value="shift_jis">日文 Shift_JIS</option>
        </select>
      </label>
      <div class="prototype-actions">
        <button
          type="button"
          disabled={!available || busy}
          onClick={() =>
            void run(async () => {
              setCopied(0);
              setHash('');
              const selected = await ComicPrototype.pickZip();
              if (selected.cancelled) return;
              setBook(selected);
              addMetric({ label: '文件复制与目录校验', ms: selected.copyMs });
              await open(selected);
            })
          }
        >
          选择 ZIP / CBZ
        </button>
        {book && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => open(book))}
          >
            重新打开副本
          </button>
        )}
        {busy && (
          <button
            type="button"
            onClick={() =>
              void ComicPrototype.cancel().catch((error: unknown) =>
                setError(message(error)),
              )
            }
          >
            取消复制
          </button>
        )}
      </div>
      {busy && <progress value={copied} max={1} aria-label="文件复制进度" />}
      {error && <p role="alert">{error}</p>}
      {book && (
        <section aria-label="当前测试文件">
          <h2>{book.name}</h2>
          <p>{(book.size / 1024 ** 2).toFixed(1)} MiB</p>
          <div class="prototype-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await ComicArchive.clearCache({ bookId: book.bookId });
                  addMetric({ label: '页面缓存已清理', ms: 0 });
                })
              }
            >
              清除此书页面缓存
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const started = performance.now();
                  const result = await ComicArchive.fingerprint({
                    path: book.path,
                  });
                  setHash(result.sha256);
                  addMetric({
                    label: '内容指纹',
                    ms: performance.now() - started,
                  });
                })
              }
            >
              计算内容指纹
            </button>
          </div>
          <output class="prototype-hash">{hash}</output>
        </section>
      )}
      <section aria-labelledby="prototype-metrics">
        <h2 id="prototype-metrics">本次测量</h2>
        <p>
          时间仅在本机显示；首图与翻页包含两次动画帧等待。内存峰值及真实滚动帧率由
          Instruments 测量。
        </p>
        {metrics.length ? (
          <ol>
            {metrics.map((item, index) => (
              <li key={index}>
                {item.label}：{item.ms.toFixed(1)} ms
              </li>
            ))}
          </ol>
        ) : (
          <p>还没有测量记录。</p>
        )}
      </section>
      <button
        type="button"
        disabled={!available || busy}
        onClick={() =>
          void run(async () => {
            await ComicArchive.clearCache({});
            await ComicPrototype.reset();
            setBook(null);
            setHash('');
            setMetrics([]);
          })
        }
      >
        删除全部原型副本与缓存
      </button>
    </main>
  );
}
