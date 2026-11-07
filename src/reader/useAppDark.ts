import { useEffect, useState } from 'preact/hooks';

const isDark = () =>
  typeof document !== 'undefined' &&
  document.documentElement.dataset.theme === 'night';

/** 书架外观（含跟随系统）解析后是否为深色；阅读背景「自动」据此选纯白或纯黑。 */
export function useAppDark(): boolean {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    setDark(isDark());
    return () => observer.disconnect();
  }, []);
  return dark;
}
