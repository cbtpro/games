import type { ReactNode } from 'react';
import type {
  GameContext,
  GameHooks,
  GameLaunchConfig,
  GameManifest,
} from '@games/shared';

/** 一个新游戏只需要提供这份定义，其余由 SDK 托管 */
export interface GameDefinition<C extends GameLaunchConfig = GameLaunchConfig> {
  manifest: GameManifest;
  /** 生命周期钩子，全部可选 */
  hooks?: GameHooks<C>;
  /** React 视图树；不提供则视为纯 DOM / Canvas 游戏 */
  render?: (ctx: GameContext<C>) => ReactNode;
}

export function defineGame<C extends GameLaunchConfig = GameLaunchConfig>(
  definition: GameDefinition<C>,
): GameDefinition<C> {
  return definition;
}

/** qiankun 注入给子应用的 props */
export interface MicroAppProps<C extends GameLaunchConfig = GameLaunchConfig> {
  container?: HTMLElement;
  config?: Partial<C> & Record<string, unknown>;
  host?: unknown;
  name?: string;
  [key: string]: unknown;
}
