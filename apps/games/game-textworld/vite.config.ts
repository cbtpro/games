import { localHttps } from '../../../tools/vite/https';
import { devOrigin } from '../../../tools/vite/network';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import qiankun from 'vite-plugin-qiankun';
import { workspaceResolve } from '../../../tools/vite/workspace';
import { inlineModuleToClassicScript } from '../../../tools/vite/qiankunInlineModule';

/**
 * 子应用名称必须与平台中注册的 game.code 完全一致，
 * 否则 qiankun 无法把它和微应用实例对应起来。
 */
const MICRO_APP_NAME = 'game-textworld';

const DEV_PORT = 7103;
const PREVIEW_PORT = 7203;

export default defineConfig(({ command }) => ({
  plugins: [
    // 必须排在 qiankun 之前：先把内联 module 脚本降级为普通脚本，
    // 否则 qiankun 的 import-html-entry 会因 React 热更新脚本而中断。
    inlineModuleToClassicScript(),
    react(),
    // useDevMode: 让开发服务器也能被主应用直接加载（生产走构建产物）
    qiankun(MICRO_APP_NAME, { useDevMode: true }),
  ],
  // 开发期直接引用 workspace 包的 TS 源码，避免依赖 dist 构建产物
  resolve: workspaceResolve,
  server: {
    https: command === 'serve' ? localHttps() : undefined,
    port: DEV_PORT,
    strictPort: true,
    host: '0.0.0.0',
    // 主应用需要按绝对地址拉取子应用资源
    origin: devOrigin(DEV_PORT),
    cors: true,
  },
  preview: {
    https: command === 'serve' ? localHttps() : undefined,
    host: '0.0.0.0',
    cors: true,
    port: PREVIEW_PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));
