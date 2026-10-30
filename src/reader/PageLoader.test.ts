import { describe, expect, it } from 'vitest';
import { PageLoader } from './PageLoader';

describe('正式双页三张窗口', () => {
  it('当前双页和后一页优先，重复或越界请求不扩大窗口，移动后释放前组', async () => {
    const calls: number[] = [];
    const loader = new PageLoader(
      { bookId: 'book', path: '/copy.zip' },
      Array.from({ length: 8 }, (_, entry) => ({
        entry,
        name: `${entry}.jpg`,
      })),
      async ({ entry }) => {
        calls.push(entry);
        return {
          url: `file:///${entry}.png`,
          width: 400,
          height: 600,
          sourceWidth: 800,
          sourceHeight: 1200,
          cached: false,
        };
      },
    );
    const version = loader.moveWindow([1, 1, 2, 3, 4, -1]);
    for (const index of [1, 2, 3, 4]) await loader.load(index, 8192, version);
    expect(calls).toEqual([1, 2, 3]);
    const next = loader.moveWindow([3, 4, 5]);
    expect(loader.get(1)).toBeUndefined();
    expect(loader.get(2)).toBeUndefined();
    expect(await loader.load(3, 8192, version)).toBeUndefined();
    await loader.load(3, 8192, next);
    expect(calls).toEqual([1, 2, 3]);
  });
});
