import { describe, expect, it } from 'vitest';
import { FullscreenSession, type FullscreenPort } from './fullscreen';
function port(initial = false) {
  let active = initial;
  const calls: boolean[] = [];
  const api: FullscreenPort = {
    read: () => active,
    set: async (value) => {
      calls.push(value);
      active = value;
    },
    subscribe: () => () => undefined,
  };
  return { api, calls, active: () => active };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
describe('阅读器全屏会话', () => {
  it('仅初始化或关闭未使用的会话不改变系统显示', async () => {
    const fake = port();
    const session = new FullscreenSession(fake.api);
    await session.initialize();
    await session.release();
    expect(fake.calls).toEqual([]);
  });
  it('进入和退出全屏，并在离开阅读时恢复原状态', async () => {
    const fake = port();
    const session = new FullscreenSession(fake.api);
    await session.toggle();
    expect(fake.active()).toBe(true);
    await session.toggle();
    expect(fake.active()).toBe(false);
    await session.toggle();
    await session.release();
    expect(fake.active()).toBe(false);
    expect(fake.calls).toEqual([true, false, true, false]);
  });
  it('原来已全屏的窗口在退出阅读后恢复全屏', async () => {
    const fake = port(true);
    const session = new FullscreenSession(fake.api);
    await session.initialize();
    await session.toggle();
    expect(fake.active()).toBe(false);
    await session.release();
    expect(fake.active()).toBe(true);
  });
  it('正在进入全屏时关闭，等迟到进入完成后再恢复，不留在全屏', async () => {
    const entered = deferred<void>(),
      pending = deferred<void>();
    const fake = port();
    const original = fake.api.set;
    fake.api.set = async (value) => {
      if (value) {
        entered.resolve();
        await pending.promise;
      }
      await original(value);
    };
    const session = new FullscreenSession(fake.api);
    const entering = session.toggle();
    await entered.promise;
    const leaving = session.release();
    pending.resolve();
    await Promise.all([entering, leaving]);
    expect(fake.calls).toEqual([true, false]);
    expect(fake.active()).toBe(false);
  });
  it('尚未开始的切换在关闭后失效，重复关闭不重复操作', async () => {
    const fake = port();
    const session = new FullscreenSession(fake.api);
    const toggle = session.toggle();
    const closed = session.release();
    await Promise.all([toggle, closed]);
    await session.release();
    expect(fake.calls).toEqual([]);
    await expect(session.toggle()).rejects.toThrow('FULLSCREEN_CLOSED');
  });
  it('失败不伪造全屏状态，重试后仍能恢复', async () => {
    const fake = port();
    let fail = true;
    const original = fake.api.set;
    fake.api.set = async (value) => {
      if (fail) {
        fail = false;
        throw new Error('不可用');
      }
      await original(value);
    };
    const session = new FullscreenSession(fake.api);
    await expect(session.toggle()).rejects.toThrow('不可用');
    expect(fake.active()).toBe(false);
    await session.toggle();
    expect(fake.active()).toBe(true);
    await session.release();
    expect(fake.active()).toBe(false);
  });
  it('初始化读取失败可重试，不以未知状态覆盖原全屏', async () => {
    const fake = port(true);
    let fail = true;
    const original = fake.api.read;
    fake.api.read = () => {
      if (fail) {
        fail = false;
        throw new Error('读取失败');
      }
      return original();
    };
    const session = new FullscreenSession(fake.api);
    await expect(session.initialize()).rejects.toThrow('读取失败');
    await session.toggle();
    await session.release();
    expect(fake.active()).toBe(true);
  });
});
