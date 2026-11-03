import { render } from 'preact';
import { effect } from '@preact/signals';
import { App } from '@/app/App';
import { startLanguage, uiLanguage, t } from '@/i18n';
import '@/styles/tokens.css';
import '@/styles/base.css';

startLanguage();
effect(() => {
  document.documentElement.lang = uiLanguage.value;
  document.title = t('微光漫卷-离线图片阅读器');
});
// 跟随系统深浅色；漫画专用的背景色设置在 RD-09 实现。
const dark = matchMedia('(prefers-color-scheme: dark)');
const applyTheme = () => {
  const preference = document.documentElement.dataset.appearance;
  document.documentElement.dataset.theme =
    preference === 'paper' || preference === 'night'
      ? preference
      : dark.matches
        ? 'night'
        : 'paper';
};
applyTheme();
dark.addEventListener('change', applyTheme);

render(<App />, document.getElementById('app')!);
