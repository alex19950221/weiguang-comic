import { describe, expect, it } from 'vitest';
import {
  canPerform,
  proEntryVisible,
  proFeatures,
  purchaseOpen,
  requiresPro,
  type ProAction,
  type ProFeature,
} from './proPolicy';

const feature = (delivered: boolean): ProFeature => ({
  id: 'crop',
  name: '',
  description: '',
  release: '1.0',
  delivered,
});

describe('Pro 开放购买与入口', () => {
  it('至少交付两项 Pro 功能才开放购买', () => {
    expect(purchaseOpen([feature(true), feature(false)])).toBe(false);
    expect(purchaseOpen([feature(true), feature(true)])).toBe(true);
    // 1.0 两项（自动裁白边、应用锁与隐藏系列）已交付，达到开放门槛。
    expect(
      proFeatures.filter((item) => item.delivered).map((i) => i.id),
    ).toEqual(['crop', 'lock']);
    expect(purchaseOpen(proFeatures)).toBe(true);
  });

  it('未开放时正式商店不显示入口，开发与沙盒可见；开放后有商店即可见', () => {
    expect(proEntryVisible('production', false)).toBe(false);
    expect(proEntryVisible('sandbox', false)).toBe(true);
    expect(proEntryVisible('development', false)).toBe(true);
    expect(proEntryVisible(null, false)).toBe(false);
    expect(proEntryVisible('production', true)).toBe(true);
    expect(proEntryVisible(null, true)).toBe(false);
  });

  it('1.0 计划正好两项，满足开放购买门槛', () => {
    expect(
      proFeatures.filter((item) => item.release === '1.0').map((i) => i.id),
    ).toEqual(['crop', 'lock']);
  });
});

describe('失去权益不丢数据', () => {
  const always: ProAction[] = [
    'crop.disable',
    'lock.unlock',
    'lock.disable',
    'series.unhide',
    'series.showHidden',
    'inplace.read',
    'inplace.remove',
    'autoplay.stop',
    'filters.reset',
  ];
  it('关闭、解锁、取消隐藏、读取已有原位书等操作免费用户也能执行', () => {
    for (const action of always) {
      expect(requiresPro(action)).toBe(false);
      expect(canPerform(action, false)).toBe(true);
    }
  });

  it('新增类操作需要 Pro，已解锁时全部可用', () => {
    const gated: ProAction[] = [
      'crop.enable',
      'lock.enable',
      'series.hide',
      'inplace.add',
      'batch.apply',
      'autoplay.start',
      'filters.change',
    ];
    for (const action of gated) {
      expect(canPerform(action, false)).toBe(false);
      expect(canPerform(action, true)).toBe(true);
    }
  });
});
