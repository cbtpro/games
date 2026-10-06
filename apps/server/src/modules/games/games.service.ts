import { ConflictException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GameDto } from '@games/shared';
import { Game, GameStatus } from './game.entity';
import type { CreateGameDto, UpdateGameDto } from './dto/game.dto';

/** 实体 -> DTO，隔离数据库结构变更对前端的影响 */
export function toGameDto(entity: Game): GameDto {
  return {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    cover: entity.cover,
    version: entity.version,
    status: entity.status as GameDto['status'],
    entryDev: entity.entryDev,
    entryProd: entity.entryProd,
    minPlayers: entity.minPlayers,
    maxPlayers: entity.maxPlayers,
    defaultConfig: entity.defaultConfig,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    @InjectRepository(Game)
    private readonly repo: Repository<Game>,
  ) {}

  async findAll(status?: GameStatus): Promise<GameDto[]> {
    const where = status ? { status } : undefined;
    const list = await this.repo.find({ where, order: { createdAt: 'ASC' } });
    return list.map(toGameDto);
  }

  async findOneByCode(code: string): Promise<GameDto> {
    const entity = await this.repo.findOne({ where: { code } });
    if (!entity) throw new NotFoundException(`游戏不存在: ${code}`);
    return toGameDto(entity);
  }

  async findEntityByCode(code: string): Promise<Game> {
    const entity = await this.repo.findOne({ where: { code } });
    if (!entity) throw new NotFoundException(`游戏不存在: ${code}`);
    return entity;
  }

  async create(dto: CreateGameDto): Promise<GameDto> {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`游戏编码已存在: ${dto.code}`);
    const entity = this.repo.create({ ...dto, status: dto.status ?? GameStatus.Published });
    return toGameDto(await this.repo.save(entity));
  }

  async update(code: string, dto: UpdateGameDto): Promise<GameDto> {
    const entity = await this.findEntityByCode(code);
    this.repo.merge(entity, dto as Partial<Game>);
    return toGameDto(await this.repo.save(entity));
  }

  async remove(code: string): Promise<{ deleted: boolean }> {
    const result = await this.repo.delete({ code });
    if (!result.affected) throw new NotFoundException(`游戏不存在: ${code}`);
    this.logger.log(`删除游戏 ${code}`);
    return { deleted: true };
  }

  /** 应用启动时播种（幂等） */
  async upsert(dto: CreateGameDto): Promise<GameDto> {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (!exists) return this.create(dto);
    this.repo.merge(exists, dto as Partial<Game>);
    return toGameDto(await this.repo.save(exists));
  }
}
