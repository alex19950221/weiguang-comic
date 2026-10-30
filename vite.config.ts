import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// 首版不做网页版，不生成 Service Worker 与 manifest；原生构建内嵌全部资源。
export default defineConfig(({ command, mode }) => ({
  define: {
    'import.meta.env.VITE_COMIC_PROTOTYPE': JSON.stringify(
      command === 'serve' || mode === 'ios-prototype',
    ),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(
      JSON.parse(
        readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
      ).version,
    ),
  },
  plugins: [
    preact(),
    {
      name: 'offline-content-policy',
      apply: 'build',
      transformIndexHtml() {
        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content:
                "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; media-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'",
            },
            injectTo: 'head-prepend',
          },
        ];
      },
    },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    outDir: mode === 'ui-prototype' ? 'prototype-dist' : 'dist',
    rollupOptions:
      mode === 'ui-prototype'
        ? { input: fileURLToPath(new URL('./prototype.html', import.meta.url)) }
        : undefined,
  },
}));
