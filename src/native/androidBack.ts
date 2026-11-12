import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'preact/hooks';

interface BackHandler {
  priority: number;
  run: () => boolean;
}
const handlers: BackHandler[] = [];
let listening = false;

/** 弹窗、阅读器、书架依次处理返回键；根页面退到后台。 */
export function useAndroidBack(run: () => boolean, priority = 0) {
  const current = useRef(run);
  current.current = run;
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const handler = { priority, run: () => current.current() };
    handlers.push(handler);
    if (!listening) {
      listening = true;
      void NativeApp.addListener('backButton', () => {
        const ordered = [...handlers]
          .reverse()
          .sort((a, b) => b.priority - a.priority);
        if (!ordered.some((item) => item.run()))
          void NativeApp.minimizeApp().catch(() => undefined);
      }).catch(() => {
        listening = false;
      });
    }
    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [priority]);
}
