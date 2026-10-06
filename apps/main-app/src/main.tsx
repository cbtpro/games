import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root 节点缺失');

/** 主应用入口。避免开发环境重复挂载子应用，未启用 React StrictMode。 */
createRoot(container).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
