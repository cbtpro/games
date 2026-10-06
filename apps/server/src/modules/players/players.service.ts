import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PlayerDto } from '@games/shared';
import { Player } from './player.entity';

export function toPlayerDto(entity: Player): PlayerDto {
  return {
    id: entity.id,
    nickname: entity.nickname,
    avatar: entity.avatar,
    createdAt: entity.createdAt.toISOString(),
  };
}

@Injectable()
export class PlayersService {
  constructor(
    @InjectRepository(Player)
    private readonly repo: Repository<Player>,
  ) {}

  /** 按昵称幂等取玩家，避免每次开局都造一个号 */
  async ensure(nickname: string, avatar?: string | null): Promise<PlayerDto> {
    const trimmed = nickname.trim();
    let entity = await this.repo.findOne({ where: { nickname: trimmed } });
    if (!entity) {
      entity = this.repo.create({ nickname: trimmed, avatar: avatar ?? null });
      entity = await this.repo.save(entity);
    }
    return toPlayerDto(entity);
  }

  async findById(id: string): Promise<PlayerDto> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return { id, nickname: '游客', avatar: null, createdAt: new Date(0).toISOString() };
    return toPlayerDto(entity);
  }

  async findAll(): Promise<PlayerDto[]> {
    const list = await this.repo.find({ order: { createdAt: 'DESC' }, take: 100 });
    return list.map(toPlayerDto);
  }
}
