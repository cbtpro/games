/// <reference types="vite/client" />

/**
 * 构建期注入的常量 `__GAMES_ASSET_ORIGIN__` 由 @games/ai 声明（见其 src/env.d.ts）。
 * 本应用通过 tools/vite/semanticModel.ts 的 assetOriginDefine() 注入它。
 */

interface ImportMetaEnv {
  /** 覆盖模型下载源，例如国内填 https://hf-mirror.com/ */
  readonly VITE_HF_HOST?: string;
  /** 是否优先加载随应用分发的本地模型 */
  readonly VITE_HF_LOCAL?: string;
  /** 本地模型目录的绝对地址 */
  readonly VITE_HF_LOCAL_PATH?: string;
}
