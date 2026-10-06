import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EventsService, type CreateEventLogInput } from './events.service';

class CreateEventLogDto implements CreateEventLogInput {
  @IsString()
  gameCode!: string;

  @IsOptional()
  @IsString()
  sessionId?: string | null;

  @IsString()
  type!: string;

  @IsString()
  phase!: string;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsInt()
  durationMs?: number | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  error?: string | null;
}

class CreateEventLogBatchDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  items!: CreateEventLogDto[];
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Post()
  @ApiOperation({ summary: '上报单条生命周期事件' })
  create(@Body() dto: CreateEventLogDto) {
    return this.service.create(dto);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量上报生命周期事件（父应用默认走这里）' })
  createBatch(@Body() dto: CreateEventLogBatchDto) {
    return this.service.createBatch(dto.items ?? []);
  }
}
