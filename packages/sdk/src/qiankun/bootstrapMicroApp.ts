import { HOST_PRESENCE_FLAG, type GameLaunchConfig } from '@games/shared';
import type { GameDefinition } from '../types';
import {
  createQiankunLifecycles,
  mountStandaloneGame,
  type QiankunLifecycles,
} from './createLifecycles';

type QiankunWindow = Window &
  Record<string, unknown> & {
    moudleQiankunAppLifeCycles?: Record<string, unknown>;
    qiankunName?: string;
  };

/**
 * 当前是否运行在宿主（主应用）内。
 *
 * 优先看 `HOST_PRESENCE_FLAG` —— 它由主应用主动写入真实 window，时序确定；
 * `window.proxy.__POWERED_BY_QIANKUN__` 仅作为兼容其它宿主方式的兜底。
 * （Vite 子应用是动态 import 进来的 ES 模块，跑在真实 window 上，
 *  直接用 qiankun 的沙箱标志判断会因时序而随机失效。）
 */
export function isEmbeddedInHost(): boolean {
  const w = window as unknown as QiankunWindow;
  const proxy = w.proxy as Record<string, unknown> | undefined;
  return (
    w[HOST_PRESENCE_FLAG] === true ||
    w.__POWERED_BY_QIANKUN__ === true ||
    proxy?.__POWERED_BY_QIANKUN__ === true
  );
}

/**
 * 把生命周期挂到 qiankun 期望的全局位置。
 * vite-plugin-qiankun 在入口脚本执行完后会读取这里，把 qiankun 的
 * bootstrap/mount/unmount/update 转接到我们的生命周期上。
 */
function registerLifecycles(name: string, lifecycles: QiankunLifecycles): void {
  const w = window as unknown as QiankunWindow;
  if (!w.moudleQiankunAppLifeCycles) {
    w.moudleQiankunAppLifeCycles = {};
  }
  w.moudleQiankunAppLifeCycles[name] = lifecycles;
}

export interface MicroAppBootstrapOptions<C extends GameLaunchConfig> {
  /** 独立运行时的挂载点，可传选择器或 DOM 节点；找不到则不挂载 */
  standaloneContainer?: string | HTMLElement | null;
  /** 独立运行时的默认参数 */
  standaloneConfig?: Partial<C>;
}

/**
 * 子应用唯一入口。
 *
 * 所有新游戏的 main.tsx 都只需要这一行：
 * `bootstrapMicroApp(game, { standaloneContainer: '#game-root' })`
 *
 * - 被主应用加载时：注册生命周期，交给宿主驱动，自己不做任何渲染决策；
 * - 单独访问时：用 StandaloneHostBridge 自行挂载，行为与内嵌完全一致。
 */
export function bootstrapMicroApp<C extends GameLaunchConfig = GameLaunchConfig>(
  definition: GameDefinition<C>,
  options: MicroAppBootstrapOptions<C> = {},
): void {
  const lifecycles = createQiankunLifecycles<C>(definition);
  const w = window as unknown as QiankunWindow;
  const name = w.qiankunName ?? definition.manifest.code;

  // 只在真的被宿主接管时注册。
  // 独立运行时若也注册，vite-plugin-qiankun 注入的收尾脚本会去读
  // window.proxy.vitemount（此时 proxy 根本不存在），抛一个无意义的 TypeError。
  if (isEmbeddedInHost()) {
    registerLifecycles(name, lifecycles);
    return;
  }

  const raw = options.standaloneContainer ?? '#game-root';
  const container =
    typeof raw === 'string' ? document.querySelector<HTMLElement>(raw) : (raw ?? null);

  if (!container) {
    console.warn(`[${name}] 未找到挂载点，且当前不在宿主中，已跳过挂载`);
    return;
  }

  void mountStandaloneGame<C>(definition, container, options.standaloneConfig ?? {});
}
