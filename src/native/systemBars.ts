import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/** 应用外观或阅读背景与系统深浅色不一致时，状态栏文字随画面底色切换，避免看不清。 */
export function setStatusBarTone(tone: 'light' | 'dark') {
  if (!Capacitor.isNativePlatform()) return;
  void SystemBars.setStyle({
    style: tone === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
  }).catch(() => undefined);
}
