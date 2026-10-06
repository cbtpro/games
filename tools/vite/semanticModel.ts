/** 语义模型构建配置：注入静态资源地址，并排除携带 WASM 的预打包依赖。 */

/** 构建期注入的常量名：本子应用静态资源的来源地址 */
export const ASSET_ORIGIN_KEY = '__GAMES_ASSET_ORIGIN__';

/**
 * 生成 define 片段。
 *
 * @param devOrigin 开发期本子应用的地址，例如 `http://127.0.0.1:7102`；
 *                  生产构建传空串，表示与部署站点同源。
 *
 * 为什么需要它：被宿主加载时页面 origin 是宿主的，且 import.meta.url
 * 会退化成 blob: URL，运行时无法推导自己的地址。
 */
export function assetOriginDefine(devOrigin: string): Record<string, string> {
  return { [ASSET_ORIGIN_KEY]: JSON.stringify(devOrigin) };
}

/** 与语义模型配套的 Vite 配置片段，展开进 defineConfig 即可 */
export const semanticModelConfig = {
  optimizeDeps: {
    // transformers.js 自带 WASM / ONNX 资源，交给它自己按需加载，
    // 避免预打包拆分 WASM 和 ONNX 资源
    exclude: ['@huggingface/transformers'],
  },
};
