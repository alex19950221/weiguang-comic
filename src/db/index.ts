import { createDatabase } from './schema';

// 模块只由正式书架入口加载，不参与M0性能原型。
export const database = createDatabase();

let opening: Promise<void> | null = null;
export function openLibraryDatabase(): Promise<void> {
  if (database.isOpen()) return Promise.resolve();
  if (!opening) {
    opening = database
      .open()
      .then(() => undefined)
      .finally(() => {
        opening = null;
      });
  }
  return opening;
}
