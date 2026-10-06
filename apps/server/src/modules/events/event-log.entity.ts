import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * 生命周期事件埋点。
 * 子应用每触发一个钩子，父应用可选择上报到这里，用于复盘与风控。
 */
@Entity('game_event_logs')
export class GameEventLog extends BaseEntity {
  @Index()
  @Column({ name: 'game_code', length: 64 })
  gameCode!: string;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId!: string | null;

  @Column({ length: 64 })
  type!: string;

  @Column({ length: 16 })
  phase!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  state!: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'json', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;
}
