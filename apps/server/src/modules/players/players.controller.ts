import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import type { PlayerDto } from '@games/shared';
import { PlayersService } from './players.service';

class CreatePlayerDto {
  @IsString()
  @Length(1, 64)
  nickname!: string;

  @IsOptional()
  @IsString()
  avatar?: string | null;
}

@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly service: PlayersService) {}

  @Post()
  @ApiOperation({ summary: '创建或获取玩家（按昵称幂等）' })
  create(@Body() dto: CreatePlayerDto): Promise<PlayerDto> {
    return this.service.ensure(dto.nickname, dto.avatar ?? null);
  }

  @Get()
  @ApiOperation({ summary: '玩家列表' })
  findAll(): Promise<PlayerDto[]> {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '玩家详情' })
  findOne(@Param('id') id: string): Promise<PlayerDto> {
    return this.service.findById(id);
  }
}
