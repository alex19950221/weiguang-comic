import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PrototypeBook {
  cancelled: false;
  bookId: string;
  path: string;
  name: string;
  size: number;
  copyMs: number;
}

interface ComicPrototypePlugin {
  pickZip(): Promise<PrototypeBook | { cancelled: true }>;
  cancel(): Promise<void>;
  reset(): Promise<void>;
  addListener(
    event: 'progress',
    listener: (event: { copied: number; total: number }) => void,
  ): Promise<PluginListenerHandle>;
}

export const ComicPrototype =
  registerPlugin<ComicPrototypePlugin>('ComicPrototype');
export const supportsPrototype = () =>
  Capacitor.getPlatform() === 'ios' &&
  Capacitor.isPluginAvailable('ComicPrototype');
