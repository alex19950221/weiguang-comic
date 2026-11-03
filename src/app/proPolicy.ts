import type { StoreEnvironment } from '@/native/proStore';

export type ProFeatureId =
  'crop' | 'lock' | 'inplace' | 'batch' | 'autoplay' | 'filters';

export interface ProFeature {
  id: ProFeatureId;
  name: string;
  description: string;
  /** 计划随哪个版本交付；已交付才在购买页列为可用。 */
  release: '1.0' | '1.1' | '1.2';
  delivered: boolean;
}

/** PRD 第 8 节（2026-11-02 确认）：1.0 裁白边、应用锁与隐藏系列；1.1 原位阅读、批量整理；1.2 自动翻页、画面滤镜。 */
export const proFeatures: readonly ProFeature[] = [
  {
    id: 'crop',
    name: '自动裁白边',
    description: '去掉扫描版四周的白边和黑边，画面更大，可按书开关。',
    release: '1.0',
    delivered: true,
  },
  {
    id: 'lock',
    name: '应用锁与隐藏系列',
    description:
      '用面容 ID 或密码进入；切到后台时遮住画面；隐藏的系列默认不显示。',
    release: '1.0',
    delivered: true,
  },
  {
    id: 'inplace',
    name: '原位阅读',
    description: '直接读取“文件”中的原件，不再复制一份，大书库省一半空间。',
    release: '1.1',
    delivered: true,
  },
  {
    id: 'batch',
    name: '批量整理',
    description: '多选后一次移入分组、标记已读或删除。',
    release: '1.1',
    delivered: true,
  },
  {
    id: 'autoplay',
    name: '自动翻页',
    description: '按设定的间隔翻页，条漫匀速滚动。',
    release: '1.2',
    delivered: true,
  },
  {
    id: 'filters',
    name: '画面滤镜',
    description: '调节对比度、锐化与暖色，不改动原文件。',
    release: '1.2',
    delivered: false,
  },
];

/** PRD：至少交付两项 Pro 功能后才开放购买。 */
export const MIN_DELIVERED_FOR_SALE = 2;
export function purchaseOpen(features: readonly ProFeature[] = proFeatures) {
  return (
    features.filter((feature) => feature.delivered).length >=
    MIN_DELIVERED_FOR_SALE
  );
}

/** 正式商店在开放购买前不显示入口；开发与 TestFlight 沙盒始终可见，便于测试购买流程。 */
export function proEntryVisible(
  environment: StoreEnvironment | null,
  open = purchaseOpen(),
) {
  if (open) return environment !== null;
  return environment === 'development' || environment === 'sandbox';
}

/**
 * 失去权益不丢数据：只有“新增”类操作需要 Pro；关闭、解锁、取消隐藏、移除等
 * 回到免费状态的操作永远可用，退款或换设备后不会把用户锁在外面。
 */
export type ProAction =
  | 'crop.enable'
  | 'crop.disable'
  | 'lock.enable'
  | 'lock.unlock'
  | 'lock.disable'
  | 'series.hide'
  | 'series.unhide'
  | 'series.showHidden'
  | 'inplace.add'
  | 'inplace.read'
  | 'inplace.remove'
  | 'batch.apply'
  | 'autoplay.start'
  | 'autoplay.stop'
  | 'filters.change'
  | 'filters.reset';

const gated: ReadonlySet<ProAction> = new Set<ProAction>([
  'crop.enable',
  'lock.enable',
  'series.hide',
  'inplace.add',
  'batch.apply',
  'autoplay.start',
  'filters.change',
]);

export function requiresPro(action: ProAction): boolean {
  return gated.has(action);
}

export function canPerform(action: ProAction, active: boolean): boolean {
  return active || !requiresPro(action);
}
