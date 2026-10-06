import { useEffect, useRef } from 'react';
import type { GameDto, GameLaunchConfig } from '@games/shared';
import { gameHost, type GameHandle } from '../host';

export interface GameStageProps {
  game: GameDto;
  config: Partial<GameLaunchConfig>;
  /** 递增即重新打开子应用 */
  launchNonce: number;
  onLaunched?: (handle: GameHandle) => void;
  onClosed?: () => void;
}

/**
 * 子应用的挂载位。
 * 只负责「装载 / 卸载」，业务语义全部交给宿主的钩子与命令（分离关注点）。
 */
export function GameStage(props: GameStageProps): JSX.Element {
  const { game, config, launchNonce, onLaunched, onClosed } = props;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let handle: GameHandle | null = null;

    void gameHost
      .launch({ game, container, config })
      .then((created) => {
        if (cancelled) {
          void created.destroy();
          return;
        }
        handle = created;
        onLaunched?.(created);
      })
      .catch((error) => {
        console.error('[GameStage] 子应用加载失败', error);
      });

    return () => {
      cancelled = true;
      if (handle) {
        void handle.destroy();
        handle = null;
      }
      onClosed?.();
    };
    // config 每次都是新对象，用 launchNonce 作为唯一触发源
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.code, launchNonce]);

  return <div className="game-stage" ref={containerRef} />;
}
