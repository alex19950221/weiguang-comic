import { Capacitor, registerPlugin } from '@capacitor/core';
import type { FullscreenPort } from '@/reader/fullscreen';

interface ComicReaderPlugin {
  getDisplayState(): Promise<{ fullscreen: boolean }>;
  setFullscreen(options: {
    enabled: boolean;
  }): Promise<{ fullscreen: boolean }>;
}
const ComicReader = registerPlugin<ComicReaderPlugin>('ComicReader');
// 所有原生显示会话共用顺序，防止旧阅读器的恢复覆盖新会话。
let displayQueue: Promise<unknown> = Promise.resolve();
function nativeDisplay<T>(operation: () => Promise<T>): Promise<T> {
  const task = displayQueue.catch(() => undefined).then(operation);
  displayQueue = task;
  return task;
}
export function createFullscreenPort(): FullscreenPort {
  if (Capacitor.isNativePlatform())
    return {
      read: () =>
        nativeDisplay(
          async () => (await ComicReader.getDisplayState()).fullscreen,
        ),
      set: (enabled) =>
        nativeDisplay(async () => {
          await ComicReader.setFullscreen({ enabled });
        }),
      subscribe: () => () => undefined,
    };
  return {
    read: () => !!document.fullscreenElement,
    set: async (enabled) => {
      if (enabled) {
        if (!document.documentElement.requestFullscreen)
          throw new Error('FULLSCREEN_UNSUPPORTED');
        await document.documentElement.requestFullscreen();
      } else if (document.fullscreenElement) {
        if (!document.exitFullscreen) throw new Error('FULLSCREEN_UNSUPPORTED');
        await document.exitFullscreen();
      }
    },
    subscribe: (listener) => {
      document.addEventListener('fullscreenchange', listener);
      return () => document.removeEventListener('fullscreenchange', listener);
    },
  };
}
