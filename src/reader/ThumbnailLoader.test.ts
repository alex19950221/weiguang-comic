import { describe, it, expect } from 'vitest';
import { ThumbnailLoader } from './ThumbnailLoader';
import type { RenderedPage } from '@/native/comicArchive';
const pages = Array.from({ length: 30 }, (_, index) => ({
  entry: index + 10,
  name: `${index}.jpg`,
}));
const image = (entry: number): RenderedPage => ({
  url: `file:///${entry}.png`,
  width: 100,
  height: 200,
  sourceWidth: 500,
  sourceHeight: 1000,
  cached: true,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('原生缩略图有界调度', () => {
  it('只发送一个原生请求，重复请求去重且使用真实entry', async () => {
    const entered = deferred<void>(),
      pending = deferred<RenderedPage>();
    const calls: number[] = [];
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async ({ entry }) => {
        calls.push(entry);
        if (entry === 10) {
          entered.resolve();
          return pending.promise;
        }
        return image(entry);
      },
    );
    const first = loader.load(0),
      duplicate = loader.load(0),
      second = loader.load(1);
    await entered.promise;
    expect(calls).toEqual([10]);
    expect(duplicate).toBe(first);
    pending.resolve(image(10));
    await Promise.all([first, duplicate, second]);
    expect(calls).toEqual([10, 11]);
  });
  it('离开可见范围的等待任务不送入原生，重新可见后可请求', async () => {
    const entered = deferred<void>(),
      pending = deferred<RenderedPage>();
    const calls: number[] = [];
    let wanted = true;
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async ({ entry }) => {
        calls.push(entry);
        if (entry === 10) {
          entered.resolve();
          return pending.promise;
        }
        return image(entry);
      },
    );
    const active = loader.load(0);
    await entered.promise;
    const cancelled = loader.load(1, () => wanted);
    wanted = false;
    pending.resolve(image(10));
    await active;
    expect(await cancelled).toBeUndefined();
    expect(calls).toEqual([10]);
    await loader.load(1);
    expect(calls).toEqual([10, 11]);
  });
  it('关闭目录丢弃迟到结果和等待项，不发新请求', async () => {
    const entered = deferred<void>(),
      pending = deferred<RenderedPage>();
    let calls = 0;
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async () => {
        calls++;
        entered.resolve();
        return pending.promise;
      },
    );
    const first = loader.load(0),
      next = loader.load(1);
    await entered.promise;
    loader.dispose();
    pending.resolve(image(10));
    expect(await first).toBeUndefined();
    expect(await next).toBeUndefined();
    expect(await loader.load(2)).toBeUndefined();
    expect(calls).toBe(1);
  });
  it('原生失败不阻断后续页，失败项允许重新请求', async () => {
    let fail = true;
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async ({ entry }) => {
        if (entry === 10 && fail) {
          fail = false;
          throw new Error('失败');
        }
        return image(entry);
      },
    );
    await expect(loader.load(0)).rejects.toThrow('失败');
    expect((await loader.load(1))?.url).toBe('file:///11.png');
    expect((await loader.load(0))?.url).toBe('file:///10.png');
  });
  it('仅保留24个最近结果，重看旧页重新取原生缩略图', async () => {
    const calls: number[] = [];
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async ({ entry }) => {
        calls.push(entry);
        return image(entry);
      },
    );
    for (let index = 0; index < 25; index++) await loader.load(index);
    await loader.load(24);
    expect(calls.length).toBe(25);
    await loader.load(0);
    expect(calls.length).toBe(26);
  });
  it('换标签后同页新可见请求不会被旧组件的取消状态吞掉', async () => {
    const entered = deferred<void>(),
      pending = deferred<RenderedPage>();
    let visible = true;
    const loader = new ThumbnailLoader(
      { id: 'book', path: '/copy.zip' },
      pages,
      async ({ entry }) => {
        if (entry === 10) {
          entered.resolve();
          return pending.promise;
        }
        return image(entry);
      },
    );
    const active = loader.load(0);
    await entered.promise;
    const old = loader.load(1, () => visible);
    visible = false;
    const replacement = loader.load(1, () => true);
    pending.resolve(image(10));
    await active;
    expect(await old).toEqual(image(11));
    expect(await replacement).toEqual(image(11));
  });
});
