export function autoplayInterval(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.round(Math.max(2, Math.min(60, value)))
    : 5;
}
export function autoplaySpeed(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.round(Math.max(10, Math.min(160, value)))
    : 40;
}

export interface AutoplayFrame {
  key: string;
  scroll: boolean;
  ready: boolean;
  failed: boolean;
  blocked: boolean;
  interval?: number;
  speed?: number;
  top: number;
  limit: number;
}
export type AutoplayDecision =
  | { kind: 'stop' | 'wait' | 'turn' }
  | { kind: 'scroll'; top: number; end: boolean };

/** 使用单调时钟；加载期间不计翻页时间，恢复或卡顿后不追赶漏掉的页面。 */
export class AutoplayClock {
  private key = '';
  private since: number | null = null;
  private previous: number | null = null;

  tick(now: number, frame: AutoplayFrame): AutoplayDecision {
    if (frame.blocked || frame.failed || !Number.isFinite(now)) {
      this.since = this.previous = null;
      return { kind: 'stop' };
    }
    if (
      frame.key !== this.key ||
      (this.previous !== null && now < this.previous)
    ) {
      this.key = frame.key;
      this.since = this.previous = null;
    }
    const elapsed =
      this.previous === null
        ? 0
        : Math.max(0, Math.min(100, now - this.previous));
    this.previous = now;
    if (!frame.ready) {
      this.since = null;
      return { kind: 'wait' };
    }
    if (frame.scroll) {
      const limit = Math.max(0, Number.isFinite(frame.limit) ? frame.limit : 0);
      const start = Math.max(0, Number.isFinite(frame.top) ? frame.top : 0);
      const top = Math.min(
        limit,
        start + (elapsed * autoplaySpeed(frame.speed)) / 1000,
      );
      return { kind: 'scroll', top, end: top >= limit - 0.5 };
    }
    this.since ??= now;
    if (now - this.since < autoplayInterval(frame.interval) * 1000)
      return { kind: 'wait' };
    this.since = now;
    return { kind: 'turn' };
  }
}
