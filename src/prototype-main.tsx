import { render } from 'preact';
import InteractivePrototype from '@/pages/InteractivePrototype';
import '@/styles/tokens.css';
import '@/styles/demo.css';

// 仅 prototype.html 引用，不接入正式数据库、原生插件或原生构建。
render(<InteractivePrototype />, document.getElementById('app')!);
