import { createContext, createElement, useContext, type ReactNode } from 'react';
import type { GameContext, GameLaunchConfig } from '@games/shared';

const GameContextReactContext = createContext<GameContext<GameLaunchConfig> | null>(null);

export interface GameProviderProps {
  ctx: GameContext<GameLaunchConfig>;
  children: ReactNode;
}

export function GameProvider(props: GameProviderProps): ReactNode {
  return createElement(
    GameContextReactContext.Provider,
    { value: props.ctx },
    props.children as ReactNode,
  );
}

/** 在任意 React 组件中拿到运行期上下文（config / host / emit / start / pause ...） */
export function useGame<C extends GameLaunchConfig = GameLaunchConfig>(): GameContext<C> {
  const ctx = useContext(GameContextReactContext);
  if (!ctx) {
    throw new Error('useGame() 必须在 <GameProvider> 内部使用，且只能用于子游戏应用中');
  }
  return ctx as unknown as GameContext<C>;
}

/** 可选版本：独立运行或测试时不抛错 */
export function useOptionalGame<C extends GameLaunchConfig = GameLaunchConfig>():
  | GameContext<C>
  | null {
  return useContext(GameContextReactContext) as unknown as GameContext<C> | null;
}
