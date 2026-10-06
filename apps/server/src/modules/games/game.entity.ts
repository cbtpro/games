import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum GameStatus {
  Draft = 'draft',
  Published = 'published',
  Offline = 'offline',
}

@Entity('games')
export class Game extends BaseEntity {
  @Index({ unique: true })
  @Column({ length: 64, comment: '游戏唯一编码，与子应用 qiankun name 一致' })
  code!: string;

  @Column({ length: 128 })
  name!: string;

  // 可空列必须显式声明 type：反射拿到的 `string | null` 会被 TypeORM 解析成 Object
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  category!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  cover!: string | null;

  @Column({ length: 32, default: '1.0.0' })
  version!: string;

  @Index()
  @Column({ type: 'enum', enum: GameStatus, default: GameStatus.Draft })
  status!: GameStatus;

  @Column({ name: 'entry_dev', length: 255, comment: '开发环境子应用入口' })
  entryDev!: string;

  @Column({ name: 'entry_prod', length: 255, comment: '生产环境子应用入口' })
  entryProd!: string;

  @Column({ name: 'min_players', type: 'int', default: 1 })
  minPlayers!: number;

  @Column({ name: 'max_players', type: 'int', default: 1 })
  maxPlayers!: number;

  @Column({
    name: 'default_config',
    type: 'json',
    nullable: true,
    comment: '平台下发的默认启动参数',
  })
  defaultConfig!: Record<string, unknown> | null;
}
