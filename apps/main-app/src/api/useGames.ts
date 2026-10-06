import { useCallback, useEffect, useState } from 'react';
import type { GameDto } from '@games/shared';
import { api } from './client';

export interface GamesState {
  games: GameDto[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * 游戏目录的唯一数据源。
 * 列表在所有页面共享同一份语义，避免各页各写一遍请求（分离关注点）。
 */
export function useGames(): GamesState {
  const [games, setGames] = useState<GameDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    api
      .listGames()
      .then((list) => {
        if (!alive) return;
        setGames(list);
        setError(null);
      })
      .catch((e: Error) => {
        if (alive) setError(`无法连接后端（${e.message}），请先启动 @games/server`);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { games, loading, error, reload };
}
