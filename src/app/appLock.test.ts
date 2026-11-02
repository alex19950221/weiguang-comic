import { describe, expect, it, vi } from 'vitest';
import { AppLock, type LockPort } from './appLock';
import type { AuthResult } from '@/native/comicLock';

function fixture(stored = false, available = true) {
  let saved = stored;
  const native = {
    availability: vi.fn(async () => ({
      available,
      biometry: 'faceID' as const,
    })),
    authenticate: vi.fn(async (): Promise<AuthResult> => ({
      ok: true,
    })),
    setPrivacyCover: vi.fn(async () => undefined),
    reveal: vi.fn(async () => undefined),
  };
  const port: LockPort = {
    native,
    load: async () => saved,
    save: vi.fn(async (value: boolean) => {
      saved = value;
    }),
    afterPaint: vi.fn(async () => undefined),
  };
  return { lock: new AppLock(port), native, port, saved: () => saved };
}

describe('应用锁', () => {
  it('未开启时启动不上锁、不验证；浏览器没有原生能力时始终不上锁', async () => {
    const { lock, native } = fixture(false);
    await lock.start();
    expect(lock.state.value).toMatchObject({ ready: true, locked: false });
    expect(native.authenticate).not.toHaveBeenCalled();
    const web = new AppLock({
      native: null,
      load: async () => true,
      save: async () => undefined,
      afterPaint: async () => undefined,
    });
    await web.start();
    expect(web.state.value.locked).toBe(false);
  });

  it('开启后启动即上锁并发起验证；取消时保持锁定，可再次解锁', async () => {
    const { lock, native } = fixture(true);
    native.authenticate.mockResolvedValueOnce({
      ok: false,
      reason: 'cancelled',
    });
    await lock.start();
    expect(native.setPrivacyCover).toHaveBeenCalledWith({ enabled: true });
    expect(lock.state.value).toMatchObject({ locked: true, error: null });
    native.authenticate.mockResolvedValueOnce({ ok: false, reason: 'failed' });
    expect(await lock.unlock()).toBe(false);
    expect(lock.state.value.error).toBe('failed');
    expect(await lock.unlock()).toBe(true);
    expect(lock.state.value).toMatchObject({ locked: false, error: null });
  });

  it('进入后台上锁；回来先画出锁屏再移开遮挡，然后验证', async () => {
    const { lock, native, port } = fixture(true);
    await lock.start();
    const order: string[] = [];
    vi.mocked(port.afterPaint).mockImplementation(async () => {
      order.push('paint');
    });
    native.reveal.mockImplementation(async () => {
      order.push('reveal');
    });
    native.authenticate.mockImplementation(async () => {
      order.push('auth');
      return { ok: true };
    });
    lock.pause();
    expect(lock.state.value.locked).toBe(true);
    await lock.resume();
    expect(order).toEqual(['paint', 'reveal', 'auth']);
    expect(lock.state.value.locked).toBe(false);
  });

  it('设备关闭密码后放行并关闭应用锁，不把用户锁在外面', async () => {
    const { lock, native, saved } = fixture(true);
    native.authenticate.mockResolvedValueOnce({
      ok: false,
      reason: 'unavailable',
    });
    await lock.start();
    expect(lock.state.value).toMatchObject({
      locked: false,
      enabled: false,
      notice: 'disabled-no-passcode',
    });
    expect(saved()).toBe(false);
    expect(native.setPrivacyCover).toHaveBeenLastCalledWith({ enabled: false });
  });

  it('开启需要 Pro 和设备密码，并先验证一次；关闭不需要 Pro', async () => {
    const { lock, native, saved } = fixture(false);
    await lock.start();
    expect(await lock.enable(false)).toBe(false);
    expect(lock.state.value.error).toBe('pro-required');
    native.authenticate.mockResolvedValueOnce({
      ok: false,
      reason: 'cancelled',
    });
    expect(await lock.enable(true)).toBe(false);
    expect(saved()).toBe(false);
    expect(await lock.enable(true)).toBe(true);
    expect(saved()).toBe(true);
    expect(native.setPrivacyCover).toHaveBeenLastCalledWith({ enabled: true });
    // 失去 Pro 后仍可关闭。
    expect(await lock.disable()).toBe(true);
    expect(saved()).toBe(false);
    expect(lock.state.value.enabled).toBe(false);
  });

  it('设备没有密码时不能开启', async () => {
    const { lock, native } = fixture(false, false);
    await lock.start();
    expect(await lock.enable(true)).toBe(false);
    expect(lock.state.value.error).toBe('no-passcode');
    expect(native.authenticate).not.toHaveBeenCalled();
  });

  it('锁定时不能关闭', async () => {
    const { lock, native } = fixture(true);
    native.authenticate.mockResolvedValueOnce({
      ok: false,
      reason: 'cancelled',
    });
    await lock.start();
    expect(await lock.disable()).toBe(false);
    expect(lock.state.value.enabled).toBe(true);
  });
});
