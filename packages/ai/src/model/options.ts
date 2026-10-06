/**
 * 语义模型的来源配置。
 *
 * 模型默认从 HuggingFace CDN 下载（首次约 110MB，之后由浏览器缓存）；
 * 也可以随应用分发、或用镜像站。三种方式可以共存，运行时按顺序尝试。
 */

declare global {
  /**
   * 构建期注入的常量：本子应用静态资源的来源地址。
   *
   * 由 `tools/vite/semanticModel.ts` 的 `assetOriginDefine()` 注入。
   * 被宿主（qiankun）加载时页面地址是宿主的，运行时 `import.meta.url`
   * 又会退化成 blob: URL —— 自己的资源地址只能在构建期写死。
   *
   * 用 `declare global` 而不是独立的 .d.ts，是为了让声明跟着模块一起被消费方看到
   * （独立 .d.ts 在没有显式引用时不会被加载，别的应用做类型检查会报找不到）。
   * 未注入时 `typeof` 判断会得到 'undefined'，走同源兜底。
   */
  // eslint-disable-next-line no-var
  var __GAMES_ASSET_ORIGIN__: string | undefined;
}

export type ModelDtype = 'int8' | 'q8' | 'fp16' | 'fp32';

export interface ModelOptions {
  /** 模型标识，默认 multilingual-e5-small（多语种、体积小、支持中文） */
  modelId?: string;
  /** 量化精度：int8 体积最小，浏览器场景的首选 */
  dtype?: ModelDtype;
  /** 覆盖模型下载源，国内可填 https://hf-mirror.com/ */
  remoteHost?: string;
  /** 是否优先加载随应用分发的本地模型 */
  allowLocalModels?: boolean;
  /** 本地模型目录，需以 / 结尾 */
  localModelPath?: string;
  /**
   * 输入前缀。e5 系列要求区分 query / passage，
   * 换模型时可以在这里改（不需要前缀的模型填空串）。
   */
  prefix?: string;
  /** 加载进度回调：0~1 */
  onProgress?: (ratio: number) => void;
}

/** 全部字段都有最终值的配置 */
export interface ResolvedModelOptions {
  modelId: string;
  dtype: ModelDtype;
  remoteHost?: string;
  allowLocalModels: boolean;
  localModelPath: string;
  prefix: string;
  onProgress?: (ratio: number) => void;
}

export const DEFAULT_MODEL_ID = 'Xenova/multilingual-e5-small';
export const DEFAULT_DTYPE: ModelDtype = 'int8';
export const DEFAULT_PREFIX = 'passage: ';

/**
 * 推导自托管模型的目录地址。
 *
 * 不能用 import.meta.url：被宿主接管后它会退化成 blob: URL；
 * 也不能用相对路径：那样会请求到宿主的域名上。
 * 所以优先取构建期注入的资源来源地址（见 tools/vite/semanticModel.ts）。
 */
export function defaultLocalModelPath(): string {
  const injected = typeof __GAMES_ASSET_ORIGIN__ === 'string' ? __GAMES_ASSET_ORIGIN__ : '';
  const base = injected || (typeof window !== 'undefined' ? window.location.href : '');
  if (!base) return '/models/';
  try {
    return new URL('/models/', base).href;
  } catch {
    return '/models/';
  }
}

export function resolveModelOptions(options: ModelOptions = {}): ResolvedModelOptions {
  return {
    modelId: options.modelId ?? DEFAULT_MODEL_ID,
    dtype: options.dtype ?? DEFAULT_DTYPE,
    remoteHost: options.remoteHost,
    allowLocalModels: options.allowLocalModels ?? false,
    localModelPath: options.localModelPath ?? defaultLocalModelPath(),
    prefix: options.prefix ?? DEFAULT_PREFIX,
    onProgress: options.onProgress,
  };
}

/** 共享实例的缓存键：来源不同的模型不能混用 */
export function modelKeyOf(options: ResolvedModelOptions): string {
  return [
    options.modelId,
    options.dtype,
    options.remoteHost ?? '',
    options.allowLocalModels ? options.localModelPath : '',
  ].join('|');
}

/**
 * 从 Vite 的环境变量读出模型配置。
 *
 * 包内不使用 import.meta（会限制模块的编译目标），由调用方把 env 传进来：
 * `modelOptionsFromEnv(import.meta.env)`。
 */
export function modelOptionsFromEnv(
  env: Record<string, string | undefined> = {},
): ModelOptions {
  return {
    remoteHost: env.VITE_HF_HOST,
    allowLocalModels: env.VITE_HF_LOCAL === 'true',
    localModelPath: env.VITE_HF_LOCAL_PATH || defaultLocalModelPath(),
  };
}
