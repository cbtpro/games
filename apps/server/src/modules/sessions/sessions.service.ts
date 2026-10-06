import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameSessionDto } from '@games/shared';
import { GameSession, SessionStatus } from './session.entity';
import { GamesService } from '../games/games.service';

export function toSessionDto(entity: GameSession, gameCode: string): GameSessionDto {
  return {
    id: entity.id,
    gameId: entity.gameId,
    gameCode,
    playerId: entity.playerId,
    status: entity.status as GameSessionDto['status'],
    config: entity.config,
    finalScore: entity.finalScore,
    startedAt: entity.startedAt?.toISOString() ?? null,
    endedAt: entity.endedAt?.toISOString() ?? null,
    durationMs: entity.durationMs,
    createdAt: entity.createdAt.toISOString(),
  };
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(GameSession)
    private readonly repo: Repository<GameSession>,
    private readonly games: GamesService,
  ) {}

  async create(input: {
    gameCode: string;
    playerId?: string | null;
    config?: Record<string, unknown> | null;
  }): Promise<GameSessionDto> {
    const game = await this.games.findEntityByCode(input.gameCode);
    const entity = this.repo.create({
      gameId: game.id,
      playerId: input.playerId ?? null,
      status: SessionStatus.Created,
      config: input.config ?? null,
      startedAt: new Date(),
    });
    const saved = await this.repo.save(entity);
    return toSessionDto(saved, game.code);
  }

  async findOne(id: string): Promise<GameSessionDto> {
    const entity = await this.repo.findOne({ where: { id }, relations: ['game'] });
    if (!entity) throw new NotFoundException(`会话不存在: ${id}`);
    return toSessionDto(entity, entity.game?.code ?? '');
  }

  async update(
    id: string,
    patch: {
      status?: SessionStatus;
      finalScore?: number | null;
      endedAt?: Date | null;
      durationMs?: number | null;
    },
  ): Promise<GameSessionDto> {
    const entity = await this.repo.findOne({ where: { id }, relations: ['game'] });
    if (!entity) throw new NotFoundException(`会话不存在: ${id}`);

    if (patch.status !== undefined) entity.status = patch.status;
    if (patch.finalScore !== undefined) entity.finalScore = patch.finalScore;
    if (patch.endedAt !== undefined) entity.endedAt = patch.endedAt;
    if (patch.durationMs !== undefined) entity.durationMs = patch.durationMs;

    if (patch.status === SessionStatus.Running && !entity.startedAt) {
      entity.startedAt = new Date();
    }

    const saved = await this.repo.save(entity);
    return toSessionDto(saved, entity.game?.code ?? '');
  }

  /** 生命周期事件驱动的会话状态流转 */
  async applyLifecycle(sessionId: string, type: string): Promise<void> {
    const map: Partial<Record<string, SessionStatus>> = {
      'game:start': SessionStatus.Running,
      'game:restart': SessionStatus.Running,
      'game:resume': SessionStatus.Running,
      'game:pause': SessionStatus.Paused,
      'game:end': SessionStatus.Ended,
      'game:unmount': SessionStatus.Ended,
    };
    const next = map[type];
    if (!next) return;
    try {
      await this.update(sessionId, {
        status: next,
        ...(next === SessionStatus.Ended || next === SessionStatus.Aborted
          ? { endedAt: new Date() }
          : {}),
      });
    } catch {
      // 会话不存在时静默：生命周期上报不应影响游戏进行
    }
  }
}
