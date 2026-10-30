import { useLayoutEffect, useRef, useState, useEffect } from 'preact/hooks';
import type { RefObject, TargetedPointerEvent } from 'preact';
import { tapAction } from './tapZones';
import { clampZoom, distance, zoomScroll, type Point } from './zoom';

interface Options {
  stage: RefObject<HTMLDivElement | null>;
  scroll: boolean;
  panY?: boolean;
  blocked: boolean;
  ended: boolean;
  chrome: boolean;
  direction: 'ltr' | 'rtl';
  resetKey: string;
  setChrome: (shown: boolean) => void;
  step: (delta: number) => void;
}
/** 只处理阅读画面；条漫纵向滚动交给浏览器，放大后单指拖动且禁止滑动翻页。 */
export function useReaderGestures(options: Options) {
  const [zoom, setZoom] = useState(100);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | (Point & { time: number; pinched: boolean; left: number; top: number })
    | null
  >(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const lastTap = useRef<(Point & { time: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(options);
  latest.current = options;
  const focus = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    left: number;
    top: number;
  } | null>(null);
  function cancelTap() {
    clearTimeout(timer.current);
    lastTap.current = null;
  }
  function zoomTo(value: number, point?: Point) {
    const stage = options.stage.current;
    if (!stage || options.scroll || options.ended || options.blocked) return;
    const rect = stage.getBoundingClientRect();
    // 连续指针事件可能先于布局提交；保留同一帧最早的尺寸和焦点。
    focus.current ??= {
      x: point ? point.x - rect.left : stage.clientWidth / 2,
      y: point ? point.y - rect.top : stage.clientHeight / 2,
      width: stage.scrollWidth,
      height: stage.scrollHeight,
      left: stage.scrollLeft,
      top: stage.scrollTop,
    };
    const next = clampZoom(value);
    zoomRef.current = next;
    setZoom(next);
  }
  useLayoutEffect(() => {
    const stage = options.stage.current,
      target = focus.current;
    focus.current = null;
    if (!stage || !target) return;
    stage.scrollLeft = zoomScroll(
      target.left,
      target.x,
      target.width,
      stage.scrollWidth,
    );
    stage.scrollTop = zoomScroll(
      target.top,
      target.y,
      target.height,
      stage.scrollHeight,
    );
  }, [zoom]);
  useLayoutEffect(() => {
    cancelTap();
    pointers.current.clear();
    gesture.current = null;
    pinch.current = null;
    focus.current = null;
    zoomRef.current = 100;
    setZoom(100);
    if (!options.scroll && options.stage.current) {
      options.stage.current.scrollLeft = 0;
      options.stage.current.scrollTop = 0;
    }
  }, [options.resetKey]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const handlers = {
    onPointerDown(event: TargetedPointerEvent<HTMLDivElement>) {
      if (
        options.blocked ||
        (event.pointerType === 'mouse' && event.button !== 0) ||
        (event.target instanceof Element && event.target.closest('button'))
      )
        return;
      const point = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, point);
      const stage = event.currentTarget;
      if (!options.scroll) stage.setPointerCapture(event.pointerId);
      if (pointers.current.size === 1)
        gesture.current = {
          ...point,
          time: Date.now(),
          pinched: false,
          left: stage.scrollLeft,
          top: stage.scrollTop,
        };
      else if (pointers.current.size === 2) {
        cancelTap();
        if (gesture.current) gesture.current.pinched = true;
        const [a, b] = [...pointers.current.values()];
        if (!options.scroll && !options.ended && a && b)
          pinch.current = { distance: distance(a, b), zoom: zoomRef.current };
      }
    },
    onPointerMove(event: TargetedPointerEvent<HTMLDivElement>) {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const initial = pinch.current;
      if (initial && pointers.current.size === 2 && initial.distance > 0) {
        const [a, b] = [...pointers.current.values()];
        if (a && b)
          zoomTo((initial.zoom * distance(a, b)) / initial.distance, {
            x: (a.x + b.x) / 2,
            y: (a.y + b.y) / 2,
          });
      } else if (
        !options.scroll &&
        (zoomRef.current > 100 || options.panY) &&
        gesture.current &&
        !gesture.current.pinched
      ) {
        const start = gesture.current;
        event.currentTarget.scrollLeft = start.left + start.x - event.clientX;
        event.currentTarget.scrollTop = start.top + start.y - event.clientY;
      }
    },
    onPointerCancel(event: TargetedPointerEvent<HTMLDivElement>) {
      pointers.current.delete(event.pointerId);
      pinch.current = null;
      if (gesture.current) gesture.current.pinched = true;
      if (!pointers.current.size) gesture.current = null;
    },
    onPointerUp(event: TargetedPointerEvent<HTMLDivElement>) {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (pointers.current.size) return;
      const start = gesture.current;
      gesture.current = null;
      if (!start || start.pinched || options.blocked) return;
      const point = { x: event.clientX, y: event.clientY };
      const dx = point.x - start.x,
        dy = point.y - start.y;
      if (
        !options.scroll &&
        zoomRef.current === 100 &&
        Math.abs(dx) > 50 &&
        Math.abs(dx) > Math.abs(dy) * 1.5
      ) {
        cancelTap();
        options.step(
          (dx < 0 ? 1 : -1) * (options.direction === 'rtl' ? -1 : 1),
        );
        return;
      }
      if (distance(start, point) > 12 || Date.now() - start.time > 600) return;
      if (options.chrome) {
        cancelTap();
        options.setChrome(false);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const action = tapAction(
        (point.x - rect.left) / rect.width,
        options.direction,
        options.scroll,
      );
      // 放大时两侧轻点也只呼出菜单，避免拖动画面时误翻页。
      if (action !== 'menu' && zoomRef.current === 100) {
        cancelTap();
        options.step(action === 'next' ? 1 : -1);
        return;
      }
      const previous = lastTap.current;
      if (
        !options.scroll &&
        !options.ended &&
        previous &&
        Date.now() - previous.time < 280 &&
        distance(previous, point) < 30
      ) {
        cancelTap();
        zoomTo(zoomRef.current > 100 ? 100 : 200, point);
        return;
      }
      cancelTap();
      lastTap.current = { ...point, time: Date.now() };
      timer.current = setTimeout(
        () => {
          const current = latest.current;
          if (!current.blocked) current.setChrome(true);
        },
        options.scroll || options.ended ? 0 : 280,
      );
    },
  };
  return { zoom, zoomTo, handlers };
}
