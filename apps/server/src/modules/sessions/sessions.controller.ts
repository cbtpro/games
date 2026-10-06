import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsObject, IsOptional, IsString } from 'class-validator';
import type { GameSessionDto } from '@games/shared';
import { SessionStatus } from './session.entity';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  @IsString()
  gameCode!: string;

  @IsOptional()
  @IsString()
  playerId?: string | null;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown> | null;
}

class UpdateSessionDto {
  @IsOptional()
  @IsString()
  status?: SessionStatus;

  @IsOptional()
  @IsInt()
  finalScore?: number | null;

  @IsOptional()
  @IsInt()
  durationMs?: number | null;
}

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Post()
  @ApiOperation({ summary: '开局：创建游戏会话' })
  create(@Body() dto: CreateSessionDto): Promise<GameSessionDto> {
    return this.service.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询会话' })
  findOne(@Param('id') id: string): Promise<GameSessionDto> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新会话（状态 / 分数 / 时长）' })
  update(@Param('id') id: string, @Body() dto: UpdateSessionDto): Promise<GameSessionDto> {
    return this.service.update(id, {
      status: dto.status,
      finalScore: dto.finalScore,
      durationMs: dto.durationMs,
      endedAt:
        dto.status === SessionStatus.Ended || dto.status === SessionStatus.Aborted
          ? new Date()
          : undefined,
    });
  }
}
