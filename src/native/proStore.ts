import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export type StoreEnvironment = 'development' | 'sandbox' | 'production';

export interface ProSnapshot {
  active: boolean;
  environment: StoreEnvironment;
  /** 商店本地化价格，例如「¥20.00」；取不到时缺省。 */
  price?: string;
}

export interface ProResult extends ProSnapshot {
  state: 'purchased' | 'pending' | 'cancelled' | 'restored';
}

/** 原生 StoreKit 2 插件：只暴露解锁状态与购买/恢复，不涉及账号或凭证。 */
export interface ProStorePlugin {
  status(options: { product?: boolean }): Promise<ProSnapshot>;
  purchase(): Promise<ProResult>;
  restore(): Promise<ProResult>;
  addListener(
    event: 'change',
    listener: (snapshot: ProSnapshot) => void,
  ): Promise<PluginListenerHandle>;
}

export const ProStore = registerPlugin<ProStorePlugin>('ProStore');
export const supportsPro = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ProStore');
