import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { GameStatus } from '../game.entity';

export class CreateGameDto {
  @ApiProperty({ example: 'snake' })
  @IsString()
  @Length(1, 64)
  code!: string;

  @ApiProperty({ example: '贪吃蛇' })
  @IsString()
  @Length(1, 128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 64)
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 512)
  cover?: string | null;

  @ApiPropertyOptional({ default: '1.0.0' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  version?: string;

  @ApiPropertyOptional({ enum: GameStatus, default: GameStatus.Draft })
  @IsOptional()
  @IsIn(Object.values(GameStatus))
  status?: GameStatus;

  @ApiProperty({ example: 'http://localhost:7101' })
  @IsString()
  entryDev!: string;

  @ApiProperty({ example: 'http://localhost:7201' })
  @IsString()
  entryProd!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minPlayers?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxPlayers?: number;

  @ApiPropertyOptional({ description: '平台下发的默认启动参数' })
  @IsOptional()
  @IsObject()
  defaultConfig?: Record<string, unknown> | null;
}

export class UpdateGameDto extends CreateGameDto {}
