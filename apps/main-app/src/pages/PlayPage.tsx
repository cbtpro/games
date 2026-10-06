import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { GameLaunchConfig } from '@games/shared';
import { api } from '../api/client';
import { useGames } from '../api/useGames';
import { EventConsole } from '../components/EventConsole';
import { GameControlBar } from '../components/GameControlBar';
import { GameStage } from '../components/GameStage';
import { LaunchForm, type LaunchFormValue } from '../components/LaunchForm';
import { eventLogStore, gameHost, type GameHandle } from '../host';
import { useEventLog } from '../host/useHost';
import { NotFoundPage } from './NotFoundPage';

/** 游戏页，加载指定子应用并管理页面交互。 */
export function PlayPage(): JSX.Element {
  const { gameCode = '' } = useParams();
  const { games, loading } = useGames();
  const game = games.find((item) => item.code === gameCode) ?? null;

  const events = useEventLog();
  const [config, setConfig] = useState<Partial<GameLaunchConfig> | null>(null);
  const [nonce, setNonce] = useState(0);
  const [handle, setHandle] = useState<GameHandle | null>(null);
  const [childState, setChildState] = useState('');

  // 订阅子应用状态，驱动控制条显示
  useEffect(() => {
    if (!handle) return;
    setChildState(handle.getState());
    return handle.onEvent((event) => setChildState(event.state));
  }, [handle]);

  const launch = useCallback(
    async (form: LaunchFormValue) => {
      if (!game) return;
      let playerId: string | undefined;
      try {
        const player = await api.ensurePlayer(form.playerName);
        playerId = player.id;
      } catch {
        playerId = undefined; // 后端不可用时仍可离线开局
      }

      setConfig({
        playerId,
        playerName: form.playerName,
        difficulty: form.difficulty,
        theme: form.theme,
        soundEnabled: form.soundEnabled,
        params: form.params,
      });
      setHandle(null);
      setNonce((value) => value + 1);
    },
    [game],
  );

  const close = useCallback(() => {
    setConfig(null);
    setHandle(null);
    setChildState('');
  }, []);

  if (loading) {
    return (
      <div className="empty surface">
        <p>正在读取游戏信息…</p>
      </div>
    );
  }

  if (!game) {
    return (
      <NotFoundPage
        title="找不到这个游戏"
        message={`平台上没有 code 为「${gameCode}」的子应用，它可能没有注册或尚未启动。`}
      />
    );
  }

  const opened = config !== null;

  return (
    <section className="play">
      <div className="play__bar">
        <Link className="btn btn--ghost btn--sm" to="/">
          ← 游戏库
        </Link>
        <div className="play__title">
          <h1>{game.name}</h1>
          <span className="badge badge--accent">{game.code}</span>
          <span className="badge badge--muted">v{game.version}</span>
        </div>
        <div className="play__spacer" />
        {opened && (
          <>
            <span className="badge badge--brand">会话 {handle?.sessionId.slice(0, 8) ?? '…'}</span>
            <span className="badge">
              状态 <span className="state-badge">{childState || 'idle'}</span>
            </span>
          </>
        )}
      </div>

      <div className="play__layout">
        <div className="play__main">
          <GameControlBar handle={handle} state={childState} onClose={close} />

          <div className="game-stage">
            {opened ? (
              <GameStage game={game} config={config} launchNonce={nonce} onLaunched={setHandle} />
            ) : (
              <div className="stage-overlay">
                <div className="stage-overlay__inner">
                  <h2>启动参数</h2>
                  <p>这些参数会作为 props 原样注入子应用，等同于「父组件打开子项目时传参」。</p>
                  <LaunchForm onSubmit={(value) => void launch(value)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="play__side">
          <section className="surface">
            <header className="panel__head">
              <h3>启动参数</h3>
            </header>
            <div className="panel__body">
              <LaunchForm
                opened={opened}
                onSubmit={(value) => void launch(value)}
                disabled={!opened}
              />
            </div>
          </section>

          <EventConsole events={events} onClear={() => eventLogStore.clear()} />
        </aside>
      </div>
    </section>
  );
}

// 页面卸载时销毁所有子应用，避免 qiankun 沙箱泄漏
window.addEventListener('beforeunload', () => {
  void gameHost.destroyAll();
});
