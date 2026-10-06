import { Body, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ScoresService } from './scores.service';

class CreateScoreDto {
  @IsString()
  gameCode!: string;

  @IsOptional()
  @IsString()
  playerId?: string | null;

  @IsOptional()
  @IsString()
  sessionId?: string | null;

  @IsNumber()
  score!: number;

  @IsOptional()
  @IsInt()
  level?: number | null;

  @IsOptional()
  @IsInt()
  durationMs?: number | null;

  @IsOptional()
  @IsObject()
  stats?: Record<string, unknown> | null;
}

@ApiTags('scores')
@Controller('scores')
export class ScoresController {
  constructor(private readonly service: ScoresService) {}

  @Post()
  @ApiOperation({ summary: '上报分数' })
  create(@Body() dto: CreateScoreDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '分数列表' })
  findAll(
    @Query('gameCode') gameCode?: string,
    @Query('playerId') playerId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    return this.service.findAll({ gameCode, playerId, sessionId, page, pageSize });
  }

  @Get('ranking')
  @ApiOperation({ summary: '排行榜' })
  ranking(
    @Query('gameCode') gameCode: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.service.ranking(gameCode, limit ?? 10);
  }
}
