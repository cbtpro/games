import {
  DEFAULT_LAUNCH_CONFIG,
  mergeLaunchConfig,
  type GameHostApi,
  type GameLaunchConfig,
} from '@games/shared';
import { GameRuntime } from '../core/GameRuntime';
import { StandaloneHostBridge } from '../bridge/StandaloneHostBridge';
import type { GameDefinition, MicroAppProps } from '../types';

/** qiankun 需要的四段生命周期 */
export interface QiankunLifecycles<C extends GameLaunchConfig = GameLaunchConfig> {
  bootstrap(props?: MicroAppProps<C>): Promise<void>;
  mount(props?: MicroAppProps<C>): Promise<void>;
  unmount(props?: MicroAppProps<C>): Promise<void>;
  update(props?: MicroAppProps<C>): Promise<void>;
}

function resolveHost(props: MicroAppProps): GameHostApi {
  const host = props.host as GameHostApi | undefined;
  if (host && typeof host.emit === 'function' && typeof host.onCommand === 'function') {
    return host;
  }
  return new StandaloneHostBridge();
}

function resolveConfig<C extends GameLaunchConfig>(
  definition: GameDefinition<C>,
  props: MicroAppProps<C>,
): C {
  return mergeLaunchConfig(DEFAULT_LAUNCH_CONFIG, {
    gameCode: definition.manifest.code,
    sessionId: `standalone-${Date.now()}`,
    ...(props.config ?? {}),
  }) as C;
}

/**
 * 把一份 GameDefinition 转成 qiankun 生命周期。
 * 子应用只需 `export const { bootstrap, mount, unmount, update } = createQiankunLifecycles(game)`。
 */
export function createQiankunLifecycles<C extends GameLaunchConfig = GameLaunchConfig>(
  definition: GameDefinition<C>,
): QiankunLifecycles<C> {
  let runtime: GameRuntime<C> | null = null;
  let destroyed = false;

  const ensure = async (props: MicroAppProps<C>): Promise<GameRuntime<C>> => {
    if (runtime && !destroyed) return runtime;
    const next = new GameRuntime<C>(definition, resolveConfig(definition, props), resolveHost(props));
    runtime = next;
    destroyed = false;
    await next.init();
    return next;
  };

  return {
    /**
     * 刻意不在这里创建 Runtime。
     *
     * 部分宿主（如 vite-plugin-qiankun）调用 bootstrap 时不会带 props，
     * 此时建 runtime 会把「独立运行」的配置与桥固化下来，导致后续
     * mount(props) 拿到的仍是那个没有宿主桥的实例。
     * 真正的 props 一定在 mount 时才会到齐，所以创建动作放在 mount。
     */
    async bootstrap() {},

    async mount(props = {}) {
      const instance = await ensure(props);
      instance.attachContainer(props.container ?? document.body);
      await instance.mount();
      await instance.activate();
    },
    async unmount() {
      if (!runtime) return;
      destroyed = true;
      await runtime.unmount();
    },
    async update(props = {}) {
      if (!runtime || destroyed) return;
      if (props.config) await runtime.patchConfig(props.config);
    },
  };
}

export interface StandaloneHandle<C extends GameLaunchConfig = GameLaunchConfig> {
  runtime: GameRuntime<C>;
  host: StandaloneHostBridge;
  destroy(): Promise<void>;
}

/**
 * 独立运行（不经主应用）时挂载游戏。
 * 行为与内嵌完全一致，只是桥把事件打到控制台 —— 子应用可脱离主应用调试。
 */
export async function mountStandaloneGame<C extends GameLaunchConfig = GameLaunchConfig>(
  definition: GameDefinition<C>,
  container: HTMLElement,
  config: Partial<C> = {},
): Promise<StandaloneHandle<C>> {
  const host = new StandaloneHostBridge();
  const runtime = new GameRuntime<C>(
    definition,
    mergeLaunchConfig(DEFAULT_LAUNCH_CONFIG, {
      gameCode: definition.manifest.code,
      sessionId: `standalone-${Date.now()}`,
      ...config,
    }) as C,
    host,
  );
  runtime.attachContainer(container);
  await runtime.init();
  await runtime.mount();
  await runtime.activate();
  return {
    runtime,
    host,
    async destroy() {
      await runtime.unmount();
    },
  };
}
