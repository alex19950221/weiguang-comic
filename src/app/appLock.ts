import { signal, type Signal } from '@preact/signals';
import type { AuthResult, Biometry, ComicLockPlugin } from '@/native/comicLock';
import { t } from '@/i18n';

export interface LockState {
  /** 已读取设置。 */
  ready: boolean;
  enabled: boolean;
  locked: boolean;
  busy: boolean;
  biometry: Biometry;
  error:
    | 'failed'
    | 'unavailable'
    | 'no-passcode'
    | 'save-failed'
    | 'pro-required'
    | null;
  /** 设备关闭了密码时已放行并关闭应用锁。 */
  notice: 'disabled-no-passcode' | null;
}

export interface LockPort {
  native: Pick<
    ComicLockPlugin,
    'availability' | 'authenticate' | 'setPrivacyCover' | 'reveal'
  > | null;
  load(): Promise<boolean>;
  save(enabled: boolean): Promise<void>;
  /** 下一帧已把锁屏画出来后再移开原生遮挡。 */
  afterPaint(): Promise<void>;
}

// 系统面容 ID/密码弹窗直接显示这段说明，调用时按当前界面语言翻译。
const UNLOCK_REASON = '解锁微光漫卷';
const ENABLE_REASON = '开启应用锁';

/**
 * 应用锁状态机。开启需要 Pro 且设备有密码；解锁与关闭永远可用（失去 Pro 不锁住用户）。
 * 启动时与从后台回来时上锁；没有原生能力（浏览器）时始终不上锁。
 */
export class AppLock {
  readonly state: Signal<LockState> = signal<LockState>({
    ready: false,
    enabled: false,
    locked: false,
    busy: false,
    biometry: 'none',
    error: null,
    notice: null,
  });

  constructor(private port: LockPort) {}

  private patch(patch: Partial<LockState>) {
    this.state.value = { ...this.state.value, ...patch };
  }

  async start() {
    const enabled = this.port.native
      ? await this.port.load().catch(() => false)
      : false;
    const biometry: Biometry = this.port.native
      ? await this.port.native
          .availability()
          .then((value) => value.biometry)
          .catch((): Biometry => 'none')
      : 'none';
    this.patch({ ready: true, enabled, locked: enabled, biometry });
    if (enabled) {
      await this.port.native?.setPrivacyCover({ enabled: true });
      await this.unlock();
    }
  }

  /** 进入后台：开启时立刻上锁，回来后需要验证。 */
  pause() {
    if (this.state.value.enabled && !this.state.value.locked)
      this.patch({ locked: true, error: null });
  }

  /** 回到前台：先让锁屏画出来再移开原生遮挡，然后自动发起一次验证。 */
  async resume() {
    if (!this.state.value.locked) {
      await this.port.native?.reveal();
      return;
    }
    await this.port.afterPaint();
    await this.port.native?.reveal();
    await this.unlock();
  }

  async unlock(): Promise<boolean> {
    const native = this.port.native;
    if (!this.state.value.locked) return true;
    if (!native) {
      this.patch({ locked: false });
      return true;
    }
    if (this.state.value.busy) return false;
    this.patch({ busy: true, error: null });
    let result: AuthResult;
    try {
      result = await native.authenticate({ reason: t(UNLOCK_REASON) });
    } catch {
      result = { ok: false, reason: 'failed' };
    }
    if (result.ok) {
      this.patch({ busy: false, locked: false });
      return true;
    }
    if (result.reason === 'unavailable') {
      // 设备关闭了密码，无法再验证：放行并关闭应用锁，避免数据被锁死。
      try {
        await this.port.save(false);
      } catch {
        // 保存失败时下次启动仍会走同样的放行逻辑。
      }
      await native.setPrivacyCover({ enabled: false });
      this.patch({
        busy: false,
        locked: false,
        enabled: false,
        notice: 'disabled-no-passcode',
      });
      return true;
    }
    this.patch({
      busy: false,
      error: result.reason === 'failed' ? 'failed' : null,
    });
    return false;
  }

  /** 开启：调用方先确认 Pro；这里确认设备有密码，并验证一次以免设置后打不开。 */
  async enable(proActive: boolean): Promise<boolean> {
    const native = this.port.native;
    if (!native || this.state.value.busy || this.state.value.enabled)
      return this.state.value.enabled;
    if (!proActive) {
      this.patch({ error: 'pro-required' });
      return false;
    }
    this.patch({ busy: true, error: null, notice: null });
    try {
      const availability = await native.availability();
      if (!availability.available) {
        this.patch({ busy: false, error: 'no-passcode' });
        return false;
      }
      const result = await native.authenticate({
        reason: t(ENABLE_REASON),
      });
      if (!result.ok) {
        this.patch({
          busy: false,
          error: result.reason === 'failed' ? 'failed' : null,
        });
        return false;
      }
      await this.port.save(true);
      await native.setPrivacyCover({ enabled: true });
      this.patch({
        busy: false,
        enabled: true,
        biometry: availability.biometry,
      });
      return true;
    } catch {
      this.patch({ busy: false, error: 'save-failed' });
      return false;
    }
  }

  /** 关闭只在已解锁时进行，不需要 Pro。 */
  async disable(): Promise<boolean> {
    if (this.state.value.locked || this.state.value.busy) return false;
    this.patch({ busy: true, error: null });
    try {
      await this.port.save(false);
      await this.port.native?.setPrivacyCover({ enabled: false });
      this.patch({ busy: false, enabled: false });
      return true;
    } catch {
      this.patch({ busy: false, error: 'save-failed' });
      return false;
    }
  }
}
