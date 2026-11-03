import { describe, expect, it } from 'vitest';
import {
  AutoplayClock,
  autoplayInterval,
  autoplaySpeed,
  type AutoplayFrame,
} from './autoplay';

const frame = (patch: Partial<AutoplayFrame> = {}): AutoplayFrame => ({
  key: 'page-0',
  scroll: false,
  ready: true,
  failed: false,
  blocked: false,
  top: 0,
  limit: 1000,
  ...patch,
});
describe('自动翻页时钟', () => {
  it('从图片真正可见后才开始计时，新页/双页组重新计时', () => {
    const clock = new AutoplayClock();
    expect(clock.tick(0, frame({ ready: false }))).toEqual({ kind: 'wait' });
    expect(clock.tick(10000, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(14999, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(15000, frame())).toEqual({ kind: 'turn' });
    expect(clock.tick(15016, frame({ key: 'spread-1-2' }))).toEqual({
      kind: 'wait',
    });
    expect(clock.tick(20015, frame({ key: 'spread-1-2' }))).toEqual({
      kind: 'wait',
    });
    expect(clock.tick(20016, frame({ key: 'spread-1-2' }))).toEqual({
      kind: 'turn',
    });
  });
  it('图片重试期间清零计时，坏页、后台或权益阻断要求停止', () => {
    const clock = new AutoplayClock();
    clock.tick(0, frame());
    clock.tick(4900, frame({ ready: false }));
    expect(clock.tick(5000, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(9999, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(10000, frame({ failed: true }))).toEqual({
      kind: 'stop',
    });
    expect(clock.tick(20000, frame({ blocked: true }))).toEqual({
      kind: 'stop',
    });
    expect(clock.tick(30000, frame())).toEqual({ kind: 'wait' });
  });
  it('卡顿后只翻一次，不追赶漏掉的页数；时钟倒退重新计时', () => {
    const clock = new AutoplayClock();
    clock.tick(0, frame());
    expect(clock.tick(60000, frame())).toEqual({ kind: 'turn' });
    expect(clock.tick(60001, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(100, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(5099, frame())).toEqual({ kind: 'wait' });
    expect(clock.tick(5100, frame())).toEqual({ kind: 'turn' });
  });
  it('条漫按速度平滑滚动，长帧最多推进 100ms，不越过卷末', () => {
    const clock = new AutoplayClock();
    clock.tick(0, frame({ scroll: true, top: 50, speed: 40 }));
    expect(clock.tick(50, frame({ scroll: true, top: 50, speed: 40 }))).toEqual(
      { kind: 'scroll', top: 52, end: false },
    );
    expect(
      clock.tick(2000, frame({ scroll: true, top: 52, speed: 40 })),
    ).toEqual({ kind: 'scroll', top: 56, end: false });
    expect(
      clock.tick(2050, frame({ scroll: true, top: 999, speed: 40 })),
    ).toEqual({ kind: 'scroll', top: 1000, end: true });
  });
  it('不把等待图片的时间累积成跳跃，单页短书立即停在实际末端', () => {
    const clock = new AutoplayClock();
    clock.tick(0, frame({ scroll: true, ready: false }));
    clock.tick(10000, frame({ scroll: true, ready: false }));
    expect(
      clock.tick(10016, frame({ scroll: true, top: 0, speed: 40 })),
    ).toEqual({ kind: 'scroll', top: 0.64, end: false });
    expect(
      clock.tick(10032, frame({ scroll: true, top: 0, limit: 0 })),
    ).toEqual({ kind: 'scroll', top: 0, end: true });
  });
  it('旧设置使用默认值，非法或极端参数不能高速跳页或无限滚动', () => {
    expect(autoplayInterval(undefined)).toBe(5);
    expect(autoplayInterval(Infinity)).toBe(5);
    expect(autoplayInterval(0)).toBe(2);
    expect(autoplayInterval(100)).toBe(60);
    expect(autoplaySpeed(NaN)).toBe(40);
    expect(autoplaySpeed(-10)).toBe(10);
    expect(autoplaySpeed(9999)).toBe(160);
    expect(new AutoplayClock().tick(NaN, frame())).toEqual({ kind: 'stop' });
  });
});
