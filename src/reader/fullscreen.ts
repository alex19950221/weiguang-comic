export interface FullscreenPort {
  read(): boolean | Promise<boolean>;
  set(enabled: boolean): Promise<void>;
  subscribe(listener: () => void): () => void;
}

/** 阅读期间独占一次显示会话；跨卷保留，退出按顺序恢复原状态。 */
export class FullscreenSession {
  private baseline: boolean | undefined;
  private touched = false;
  private disposed = false;
  private initial: Promise<void> | null = null;
  private tail: Promise<void> = Promise.resolve();
  constructor(private port: FullscreenPort) {}
  initialize() {
    if (!this.initial && !this.disposed) {
      this.initial = Promise.resolve().then(async () => {
        this.baseline = await this.port.read();
      });
      this.tail = this.initial;
    }
    return this.initial ?? Promise.resolve();
  }
  toggle(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('FULLSCREEN_CLOSED'));
    void this.initialize();
    this.tail = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (this.disposed) return;
        const active = await this.port.read();
        this.baseline ??= active;
        this.touched = true;
        await this.port.set(!active);
      });
    return this.tail;
  }
  release(): Promise<void> {
    if (this.disposed) return this.tail;
    this.disposed = true;
    this.tail = this.tail
      .catch(() => undefined)
      .then(async () => {
        if (this.touched && this.baseline !== undefined)
          await this.port.set(this.baseline);
      });
    return this.tail;
  }
}
