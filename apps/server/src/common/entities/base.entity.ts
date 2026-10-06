import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** 所有实体的公共字段，避免每个表重复定义 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 不要给 datetime 声明 precision：TypeORM 会生成 `datetime(3) DEFAULT CURRENT_TIMESTAMP(6)`，
  // 精度不匹配会被 MySQL 8 拒绝（Invalid default value）
  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date;
}
