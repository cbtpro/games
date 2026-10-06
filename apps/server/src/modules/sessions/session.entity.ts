import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Game } from '../games/game.entity';
import { Player } from '../players/player.entity';

export enum SessionStatus {
  Created = 'created',
  Running = 'running',
  Paused = 'paused',
  Ended = 'ended',
  Aborted = 'aborted',
}

@Entity('game_sessions')
export class GameSession extends BaseEntity {
  @Index()
  @Column({ name: 'game_id' })
  gameId!: string;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game_id' })
  game!: Game;

  @Index()
  @Column({ name: 'player_id', type: 'varchar', length: 64, nullable: true })
  playerId!: string | null;

  @ManyToOne(() => Player, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'player_id' })
  player!: Player | null;

  @Index()
  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.Created })
  status!: SessionStatus;

  @Column({ type: 'json', nullable: true })
  config!: Record<string, unknown> | null;

  @Column({ name: 'final_score', type: 'int', nullable: true })
  finalScore!: number | null;

  @Column({ name: 'started_at', type: 'datetime', precision: 3, nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'datetime', precision: 3, nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs!: number | null;
}
