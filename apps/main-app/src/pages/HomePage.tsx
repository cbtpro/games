import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGames } from '../api/useGames';
import { GameCard } from '../components/GameCard';
import type { GameDto } from '@games/shared';

/** 首页：游戏库列表，点击卡片才进入具体的游戏页 */
export function HomePage(): JSX.Element {
  const navigate = useNavigate();
  const { games, loading, error, reload } = useGames();

  const categories = new Set(games.map((game) => game.category ?? '未分类'));

  const open = useCallback(
    (game: GameDto) => {
      navigate(`/play/${game.code}`);
    },
    [navigate],
  );

  return (
    <>
      <section className="hero">
        <div>
          <span className="hero__eyebrow">qiankun · 微前端游戏平台</span>
          <h1>
            一个骨架，<em>无限游戏</em>
          </h1>
          <p className="hero__lead">
            每个子游戏都是独立工程，可单独开发、单独部署。主应用统一负责装载、传参、生命周期编排与事件回收。
          </p>
        </div>

        <div className="hero__stats">
          <div>
            <div className="hero__stat-value">{games.length}</div>
            <div className="hero__stat-label">已接入游戏</div>
          </div>
          <div>
            <div className="hero__stat-value">{categories.size}</div>
            <div className="hero__stat-label">游戏分类</div>
          </div>
        </div>
      </section>

      {error && (
        <div className="empty surface">
          <h2>后端未就绪</h2>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={reload}>
            重试
          </button>
        </div>
      )}

      {!error && loading && (
        <div className="grid" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="surface" style={{ height: 320, opacity: 0.6 }} />
          ))}
        </div>
      )}

      {!error && !loading && games.length === 0 && (
        <div className="empty surface">
          <h2>还没有游戏</h2>
          <p>
            用 <code>pnpm create:game &lt;name&gt;</code> 基于模板生成一个子游戏。
          </p>
        </div>
      )}

      {!error && !loading && games.length > 0 && (
        <div className="grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onOpen={open} />
          ))}
        </div>
      )}
    </>
  );
}
