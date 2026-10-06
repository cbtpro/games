import type { GameDto } from '@games/shared';

export interface GameCardProps {
  game: GameDto;
  onOpen: (game: GameDto) => void;
}

const CATEGORY_TEXT: Record<string, string> = {
  template: '模板',
  puzzle: '益智',
  arcade: '街机',
  card: '棋牌',
  strategy: '策略',
};

/** 游戏库中的游戏卡片。 */
export function GameCard(props: GameCardProps): JSX.Element {
  const { game, onOpen } = props;
  const category = game.category ? (CATEGORY_TEXT[game.category] ?? game.category) : '未分类';

  return (
    <button className="game-card" onClick={() => onOpen(game)}>
      <div className="game-card__cover" aria-hidden>
        {game.name.slice(0, 1)}
      </div>

      <div>
        <h3 className="game-card__title">{game.name}</h3>
        <div className="game-card__meta">
          <span className="badge badge--brand">{category}</span>
          <span className="badge badge--muted">v{game.version}</span>
        </div>
      </div>

      <p className="game-card__desc">{game.description ?? '暂无描述'}</p>

      <div className="game-card__cta">
        <span>进入游戏</span>
        <span aria-hidden>→</span>
      </div>
    </button>
  );
}
