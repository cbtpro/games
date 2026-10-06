import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { GameDto } from '@games/shared';
import { GamesService } from './games.service';
import { GameStatus } from './game.entity';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly service: GamesService) {}

  @Get()
  @ApiOperation({ summary: '游戏列表' })
  findAll(@Query('status') status?: GameStatus): Promise<GameDto[]> {
    return this.service.findAll(status);
  }

  @Get(':code')
  @ApiOperation({ summary: '按编码查询单个游戏' })
  findOne(@Param('code') code: string): Promise<GameDto> {
    return this.service.findOneByCode(code);
  }

  @Post()
  @ApiOperation({ summary: '注册游戏' })
  create(@Body() dto: CreateGameDto): Promise<GameDto> {
    return this.service.create(dto);
  }

  @Patch(':code')
  @ApiOperation({ summary: '更新游戏' })
  update(@Param('code') code: string, @Body() dto: UpdateGameDto): Promise<GameDto> {
    return this.service.update(code, dto);
  }

  @Delete(':code')
  @ApiOperation({ summary: '删除游戏' })
  remove(@Param('code') code: string): Promise<{ deleted: boolean }> {
    return this.service.remove(code);
  }
}
