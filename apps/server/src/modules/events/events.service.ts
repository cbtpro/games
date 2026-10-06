import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEventLog } from './event-log.entity';

export interface CreateEventLogInput {
  gameCode: string;
  sessionId?: string | null;
  type: string;
  phase: string;
  state?: string | null;
  durationMs?: number | null;
  payload?: Record<string, unknown> | null;
  error?: string | null;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(GameEventLog)
    private readonly repo: Repository<GameEventLog>,
  ) {}

  async create(input: CreateEventLogInput): Promise<{ accepted: boolean }> {
    try {
      const entity = this.repo.create({
        gameCode: input.gameCode,
        sessionId: input.sessionId ?? null,
        type: input.type,
        phase: input.phase,
        state: input.state ?? null,
        durationMs: input.durationMs ?? null,
        payload: this.safeJson(input.payload),
        error: input.error ?? null,
      });
      await this.repo.save(entity);
      return { accepted: true };
    } catch (error) {
      // 埋点失败绝不能影响游戏进行
      this.logger.warn(`事件落库失败: ${(error as Error).message}`);
      return { accepted: false };
    }
  }

  async createBatch(inputs: CreateEventLogInput[]): Promise<{ accepted: number }> {
    if (!inputs.length) return { accepted: 0 };
    const entities = inputs.slice(0, 200).map((input) =>
      this.repo.create({
        gameCode: input.gameCode,
        sessionId: input.sessionId ?? null,
        type: input.type,
        phase: input.phase,
        state: input.state ?? null,
        durationMs: input.durationMs ?? null,
        payload: this.safeJson(input.payload),
        error: input.error ?? null,
      }),
    );
    try {
      await this.repo.save(entities);
      return { accepted: entities.length };
    } catch (error) {
      this.logger.warn(`批量事件落库失败: ${(error as Error).message}`);
      return { accepted: 0 };
    }
  }

  /** 防止循环引用 / BigInt 导致 JSON 序列化炸掉 */
  private safeJson(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object') return null;
    try {
      return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
