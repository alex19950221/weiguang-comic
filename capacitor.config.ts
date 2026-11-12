import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 2026-10-29 已定：Bundle ID 与 Pro 商品标识见开发计划第 2.6 节
  appId: 'dev.weiguang.comic',
  appName: '微光漫卷',
  webDir: 'dist',
  android: {
    // 构建产物已包含全部离线资源，无需远程加载
    allowMixedContent: false,
    // 网页构建使用 ES2022；旧内核显示本地说明，避免启动后空白。
    minWebViewVersion: 94,
  },
  server: { errorPath: 'android-webview-error.html' },
};

export default config;
