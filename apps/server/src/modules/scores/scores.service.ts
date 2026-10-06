import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ScoreRecordDto } from '@games/shared';
import { ScoreRecord } from './score.entity';
import { GamesService } from '../games/games.service';

export function toScoreDto(entity: ScoreRecord): ScoreRecordDto {
  return {
    id: entity.id,
    gameId: entity.gameId,
    gameCode: entity.gameCode,
    playerId: entity.playerId,
    sessionId: entity.sessionId,
    score: entity.score,
    level: entity.level,
    durationMs: entity.durationMs,
    stats: entity.stats,
    createdAt: entity.createdAt.toISOString(),
  };
}

export interface ScoreQuery {
  gameCode?: string;
  playerId?: string;
  sessionId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    @InjectRepository(ScoreRecord)
    private readonly repo: Repository<ScoreRecord>,
    private readonly games: GamesService,
  ) {}

  async create(input: {
    gameCode: string;
    playerId?: string | null;
    sessionId?: string | null;
    score: number;
    level?: number | null;
    durationMs?: number | null;
    stats?: Record<string, unknown> | null;
  }): Promise<ScoreRecordDto> {
    // 分数必须可序列化，NaN / Infinity 会污染 MySQL
    const score = Number.isFinite(input.score) ? Math.round(input.score) : 0;
    const gameId = await this.resolveGameId(input.gameCode);
    const entity = this.repo.create({
      gameId,
      gameCode: input.gameCode,
      playerId: input.playerId ?? null,
      sessionId: input.sessionId ?? null,
      score,
      level: input.level ?? null,
      durationMs: input.durationMs ?? null,
      stats: input.stats ?? null,
    });
    return toScoreDto(await this.repo.save(entity));
  }

  /** 游戏未注册时也不阻塞计分，gameId 留空即可 */
  private async resolveGameId(gameCode: string): Promise<string> {
    try {
      const game = await this.games.findEntityByCode(gameCode);
      return game.id;
    } catch {
      return '';
    }
  }

  async findAll(query: ScoreQuery): Promise<{ items: ScoreRecordDto[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const qb = this.repo.createQueryBuilder('s');
    if (query.gameCode) qb.andWhere('s.game_code = :gameCode', { gameCode: query.gameCode });
    if (query.playerId) qb.andWhere('s.player_id = :playerId', { playerId: query.playerId });
    if (query.sessionId) qb.andWhere('s.session_id = :sessionId', { sessionId: query.sessionId });

    const [items, total] = await qb
      .orderBy('s.score', 'DESC')
      .addOrderBy('s.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items: items.map(toScoreDto), total };
  }

  async ranking(gameCode: string, limit = 10): Promise<ScoreRecordDto[]> {
    const list = await this.repo.find({
      where: { gameCode },
      order: { score: 'DESC', createdAt: 'ASC' },
      take: Math.min(50, Math.max(1, limit)),
    });
    return list.map(toScoreDto);
  }
}
