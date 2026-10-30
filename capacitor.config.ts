import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // 2026-10-29 已定：Bundle ID 与 Pro 商品标识见开发计划第 2.6 节
  appId: 'dev.weiguang.comic',
  appName: '微光漫画',
  webDir: 'dist',
  android: {
    // 构建产物已包含全部离线资源，无需远程加载
    allowMixedContent: false,
  },
};

export default config;
