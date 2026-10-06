import { localHttps } from '../../tools/vite/https';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { workspaceResolve } from '../../tools/vite/workspace';

/** 后端地址可用 VITE_SERVER_TARGET 覆盖，默认 http://127.0.0.1:3000 */
const SERVER_TARGET = process.env.VITE_SERVER_TARGET ?? 'http://127.0.0.1:3000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // 开发期直接引用 workspace 包的 TS 源码，避免依赖 dist 构建产物
  resolve: workspaceResolve,
  server: {
    https: command === 'serve' ? localHttps() : undefined,
    port: 7100,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: SERVER_TARGET, changeOrigin: true },
      '/health': { target: SERVER_TARGET, changeOrigin: true },
    },
  },
  preview: {
    https: command === 'serve' ? localHttps() : undefined,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: SERVER_TARGET, changeOrigin: true },
      '/health': { target: SERVER_TARGET, changeOrigin: true },
    },
    port: 7100,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));
