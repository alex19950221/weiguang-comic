import { describe, expect, it, vi } from 'vitest';
import { ProStoreState, type ProPort } from './pro';
import type { ProSnapshot } from '@/native/proStore';

function port(
  snapshot: ProSnapshot = { active: false, environment: 'sandbox' },
) {
  let emit: (value: ProSnapshot) => void = () => undefined;
  const remove = vi.fn(async () => undefined);
  const fake = {
    status: vi.fn<ProPort['status']>(async ({ product }) => ({
      ...snapshot,
      ...(product ? { price: '¥20.00' } : {}),
    })),
    purchase: vi.fn<ProPort['purchase']>(),
    restore: vi.fn<ProPort['restore']>(),
    addListener: vi.fn(async (_event: 'change', listener) => {
      emit = listener;
      return { remove };
    }),
  } satisfies ProPort;
  return { fake, remove, emit: (value: ProSnapshot) => emit(value) };
}

describe('Pro 状态', () => {
  it('没有商店的环境标记为不可用，不调用原生', async () => {
    const store = new ProStoreState(null);
    await store.start();
    await store.purchase();
    expect(store.state.value.status).toBe('unavailable');
  });

  it('启动读取状态与价格，并响应原生变化（如家人共享、退款）', async () => {
    const { fake, emit } = port();
    const store = new ProStoreState(fake);
    await store.start();
    expect(store.state.value).toMatchObject({
      status: 'free',
      environment: 'sandbox',
    });
    await store.refresh(true);
    expect(store.state.value.price).toBe('¥20.00');
    emit({ active: true, environment: 'sandbox' });
    expect(store.state.value.status).toBe('pro');
    emit({ active: false, environment: 'sandbox' });
    expect(store.state.value).toMatchObject({
      status: 'free',
      price: '¥20.00',
    });
  });

  it('购买成功解锁；取消不提示；等待批准保持免费并提示', async () => {
    const { fake } = port();
    const store = new ProStoreState(fake);
    fake.purchase.mockResolvedValueOnce({
      state: 'cancelled',
      active: false,
      environment: 'sandbox',
    });
    await store.purchase();
    expect(store.state.value).toMatchObject({
      status: 'free',
      notice: null,
      busy: null,
    });
    fake.purchase.mockResolvedValueOnce({
      state: 'pending',
      active: false,
      environment: 'sandbox',
    });
    await store.purchase();
    expect(store.state.value).toMatchObject({
      status: 'free',
      notice: 'pending',
    });
    fake.purchase.mockResolvedValueOnce({
      state: 'purchased',
      active: true,
      environment: 'sandbox',
    });
    await store.purchase();
    expect(store.state.value).toMatchObject({
      status: 'pro',
      notice: 'purchased',
      error: null,
    });
  });

  it('恢复购买区分已恢复与没有可恢复的记录；失败显示原因且可重试', async () => {
    const { fake } = port();
    const store = new ProStoreState(fake);
    fake.restore.mockResolvedValueOnce({
      state: 'restored',
      active: false,
      environment: 'production',
    });
    await store.restore();
    expect(store.state.value.notice).toBe('nothing-to-restore');
    fake.restore.mockRejectedValueOnce(new Error('网络不可用'));
    await store.restore();
    expect(store.state.value).toMatchObject({
      error: '网络不可用',
      busy: null,
    });
    fake.restore.mockResolvedValueOnce({
      state: 'restored',
      active: true,
      environment: 'production',
    });
    await store.restore();
    expect(store.state.value).toMatchObject({
      status: 'pro',
      notice: 'restored',
      error: null,
    });
  });

  it('进行中的购买不会重复发起；销毁后取消订阅且不再更新', async () => {
    const { fake, remove, emit } = port();
    const store = new ProStoreState(fake);
    await store.start();
    let finish!: () => void;
    fake.purchase.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              state: 'purchased',
              active: true,
              environment: 'sandbox',
            });
        }),
    );
    const first = store.purchase();
    await store.purchase();
    expect(fake.purchase).toHaveBeenCalledTimes(1);
    finish();
    await first;
    store.dispose();
    expect(remove).toHaveBeenCalled();
    emit({ active: false, environment: 'sandbox' });
    expect(store.state.value.status).toBe('pro');
  });
});
