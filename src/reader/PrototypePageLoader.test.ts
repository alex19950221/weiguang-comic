import { describe, expect, it, vi } from 'vitest';
import type { RenderedPage } from '@/native/comicArchive';
import type { PrototypeBook } from '@/native/comicPrototype';
import { PrototypePageLoader } from './PrototypePageLoader';

const book: PrototypeBook = {
  cancelled: false,
  bookId: 'test-book',
  path: '/test.zip',
  name: 'test.zip',
  size: 100,
  copyMs: 1,
};
const pages = Array.from({ length: 5 }, (_, index) => ({
  entry: index + 10,
  name: `${index}.jpg`,
}));
const image = (entry: number): RenderedPage => ({
  url: `file:///cache/${entry}.png`,
  width: 800,
  height: 1200,
  sourceWidth: 1600,
  sourceHeight: 2400,
  cached: false,
});
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Promise 尚未初始化');
  };
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('原型页加载调度', () => {
  it('原生解码串行执行，避免邻页同时占用解码内存', async () => {
    const entered = deferred<void>();
    const pending = deferred<RenderedPage>();
    const render = vi.fn(async ({ entry }: { entry: number }) => {
      if (entry === 10) {
        entered.resolve();
        return pending.promise;
      }
      return image(entry);
    });
    const loader = new PrototypePageLoader(book, pages, render);
    const version = loader.move(0);
    const first = loader.load(0, 8192, version);
    const next = loader.load(1, 8192, version);
    await entered.promise;
    expect(render).toHaveBeenCalledTimes(1);
    pending.resolve(image(10));
    await first;
    expect((await next)?.url).toBe(image(11).url);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('翻页后不启动旧预读，也不把旧解码结果放回内存', async () => {
    const entered = deferred<void>();
    const pending = deferred<RenderedPage>();
    const render = vi.fn(async () => {
      entered.resolve();
      return pending.promise;
    });
    const loader = new PrototypePageLoader(book, pages, render);
    const old = loader.move(0);
    const first = loader.load(0, 8192, old);
    const next = loader.load(1, 8192, old);
    await entered.promise;
    loader.move(4);
    pending.resolve(image(10));
    expect(await first).toBeUndefined();
    expect(await next).toBeUndefined();
    expect(loader.get(0)).toBeUndefined();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('损坏页不会阻断随后页面的读取', async () => {
    const render = vi.fn(async ({ entry }: { entry: number }) => {
      if (entry === 10) throw new Error('CRC error');
      return image(entry);
    });
    const loader = new PrototypePageLoader(book, pages, render);
    const version = loader.move(0);
    await expect(loader.load(0, 8192, version)).rejects.toThrow('CRC error');
    expect((await loader.load(1, 8192, version))?.url).toBe(image(11).url);
  });

  it('只保留邻近三页，旧版本即使命中缓存也不得返回', async () => {
    const render = vi.fn(async ({ entry }: { entry: number }) => image(entry));
    const loader = new PrototypePageLoader(book, pages, render);
    const old = loader.move(1);
    await Promise.all(
      [0, 1, 2, 3].map((index) => loader.load(index, 8192, old)),
    );
    expect(render).toHaveBeenCalledTimes(3);
    expect(loader.get(3)).toBeUndefined();
    loader.move(2);
    expect(loader.get(0)).toBeUndefined();
    expect(await loader.load(1, 8192, old)).toBeUndefined();
    expect(loader.get(1)).toBeDefined();
  });

  it('重试清空失效地址后重新请求原生层', async () => {
    const render = vi.fn(async ({ entry }: { entry: number }) => image(entry));
    const loader = new PrototypePageLoader(book, pages, render);
    const first = loader.move(0);
    await loader.load(0, 8192, first);
    loader.clear();
    expect(loader.get(0)).toBeUndefined();
    expect(await loader.load(0, 8192, first)).toBeUndefined();
    await loader.load(0, 8192, loader.move(0));
    expect(render).toHaveBeenCalledTimes(2);
  });

  it('退出阅读后，迟到的结果和新请求都不会重新占用缓存', async () => {
    const entered = deferred<void>();
    const pending = deferred<RenderedPage>();
    const render = vi.fn(async () => {
      entered.resolve();
      return pending.promise;
    });
    const loader = new PrototypePageLoader(book, pages, render);
    const first = loader.load(0, 8192, loader.move(0));
    await entered.promise;
    loader.dispose();
    pending.resolve(image(10));
    expect(await first).toBeUndefined();
    expect(await loader.load(0, 8192, loader.move(0))).toBeUndefined();
    expect(loader.get(0)).toBeUndefined();
    expect(render).toHaveBeenCalledTimes(1);
  });
});
