import { App as NativeApp } from '@capacitor/app';
import { database } from '@/db';
import { ComicLock, supportsLock } from '@/native/comicLock';
import { AppLock } from './appLock';

let shared: AppLock | null = null;

/** 应用内唯一的应用锁；设置存于 settings 表的 app.lock，前后台切换由 Capacitor App 事件驱动。 */
export function appLock(): AppLock {
  if (shared) return shared;
  const native = supportsLock() ? ComicLock : null;
  const lock = new AppLock({
    native,
    load: async () => {
      const setting = await database.settings.get('app.lock');
      return setting?.key === 'app.lock' && setting.value === true;
    },
    save: async (enabled) => {
      await database.settings.put({ key: 'app.lock', value: enabled });
    },
    afterPaint: () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  });
  if (native) {
    void NativeApp.addListener('pause', () => lock.pause());
    void NativeApp.addListener('resume', () => void lock.resume());
  }
  shared = lock;
  return lock;
}
export const lockAvailable = supportsLock;
