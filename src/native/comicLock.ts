import { Capacitor, registerPlugin } from '@capacitor/core';

export type Biometry = 'faceID' | 'touchID' | 'none';
export interface LockAvailability {
  /** 设备设置了密码（或生物识别），可以验证。 */
  available: boolean;
  biometry: Biometry;
}
export interface AuthResult {
  ok: boolean;
  /** cancelled：用户取消；unavailable：设备已关闭密码；failed：验证失败；busy：已有验证进行中。 */
  reason?: 'cancelled' | 'unavailable' | 'failed' | 'busy';
}

export interface ComicLockPlugin {
  availability(): Promise<LockAvailability>;
  authenticate(options: { reason: string }): Promise<AuthResult>;
  setPrivacyCover(options: { enabled: boolean }): Promise<void>;
  reveal(): Promise<void>;
}

export const ComicLock = registerPlugin<ComicLockPlugin>('ComicLock');
export const supportsLock = () =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ComicLock');
