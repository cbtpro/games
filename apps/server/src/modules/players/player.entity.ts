import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('players')
export class Player extends BaseEntity {
  @Index()
  @Column({ length: 64 })
  nickname!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  avatar!: string | null;
}
