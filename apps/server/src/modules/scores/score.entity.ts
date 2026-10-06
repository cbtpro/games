import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('score_records')
export class ScoreRecord extends BaseEntity {
  @Index()
  @Column({ name: 'game_id' })
  gameId!: string;

  @Index()
  @Column({ name: 'game_code', length: 64 })
  gameCode!: string;

  @Index()
  @Column({ name: 'player_id', type: 'varchar', length: 64, nullable: true })
  playerId!: string | null;

  @Index()
  @Column({ name: 'session_id', type: 'varchar', length: 64, nullable: true })
  sessionId!: string | null;

  @Index()
  @Column({ type: 'int', default: 0 })
  score!: number;

  @Column({ type: 'int', nullable: true })
  level!: number | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'json', nullable: true })
  stats!: Record<string, unknown> | null;
}
