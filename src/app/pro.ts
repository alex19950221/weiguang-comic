import { signal, type Signal } from '@preact/signals';
import {
  ProStore,
  supportsPro,
  type ProResult,
  type ProSnapshot,
  type ProStorePlugin,
  type StoreEnvironment,
} from '@/native/proStore';

export interface ProState {
  /** unknown：尚未读到；unavailable：浏览器等没有商店的环境。 */
  status: 'unknown' | 'free' | 'pro' | 'unavailable';
  environment: StoreEnvironment | null;
  price: string | null;
  busy: 'purchase' | 'restore' | null;
  /** 最近一次购买/恢复的结果，用于界面提示；不持久化。 */
  notice: 'purchased' | 'pending' | 'restored' | 'nothing-to-restore' | null;
  error: string | null;
}

export type ProPort = Pick<
  ProStorePlugin,
  'status' | 'purchase' | 'restore' | 'addListener'
>;

const initial: ProState = {
  status: 'unknown',
  environment: null,
  price: null,
  busy: null,
  notice: null,
  error: null,
};

function message(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : '操作未完成，请稍后重试。';
}

export class ProStoreState {
  readonly state: Signal<ProState>;
  private remove: (() => void) | null = null;
  private disposed = false;

  constructor(private port: ProPort | null) {
    this.state = signal<ProState>(
      port ? initial : { ...initial, status: 'unavailable' },
    );
  }

  private apply(snapshot: ProSnapshot, patch: Partial<ProState> = {}) {
    if (this.disposed) return;
    this.state.value = {
      ...this.state.value,
      status: snapshot.active ? 'pro' : 'free',
      environment: snapshot.environment,
      price: snapshot.price ?? this.state.value.price,
      ...patch,
    };
  }

  /** 启动时读状态并订阅原生变化（家人共享、退款、询问购买获批）。 */
  async start() {
    if (!this.port) return;
    try {
      const handle = await this.port.addListener('change', (snapshot) =>
        this.apply(snapshot),
      );
      if (this.disposed) void handle.remove();
      else this.remove = () => void handle.remove();
    } catch {
      // 订阅失败不影响主动读取。
    }
    await this.refresh(false);
  }

  async refresh(withPrice: boolean) {
    if (!this.port) return;
    try {
      this.apply(await this.port.status({ product: withPrice }));
    } catch (error: unknown) {
      if (!this.disposed)
        this.state.value = { ...this.state.value, error: message(error) };
    }
  }

  private async run(
    kind: 'purchase' | 'restore',
    action: () => Promise<ProResult>,
  ) {
    if (!this.port || this.state.value.busy) return;
    this.state.value = {
      ...this.state.value,
      busy: kind,
      notice: null,
      error: null,
    };
    try {
      const result = await action();
      const notice: ProState['notice'] =
        result.state === 'cancelled'
          ? null
          : result.state === 'restored'
            ? result.active
              ? 'restored'
              : 'nothing-to-restore'
            : result.state;
      this.apply(result, { busy: null, notice });
    } catch (error: unknown) {
      if (!this.disposed)
        this.state.value = {
          ...this.state.value,
          busy: null,
          error: message(error),
        };
    }
  }

  purchase() {
    return this.run('purchase', () => this.port!.purchase());
  }

  restore() {
    return this.run('restore', () => this.port!.restore());
  }

  dispose() {
    this.disposed = true;
    this.remove?.();
    this.remove = null;
  }
}

let shared: ProStoreState | null = null;
/** 应用内唯一的 Pro 状态；首次使用时连接原生商店。 */
export function proStore(): ProStoreState {
  if (!shared) {
    shared = new ProStoreState(supportsPro() ? ProStore : null);
    void shared.start();
  }
  return shared;
}
