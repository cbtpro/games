import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamesModule } from '../games/games.module';
import { ScoreRecord } from './score.entity';
import { ScoresService } from './scores.service';
import { ScoresController } from './scores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ScoreRecord]), GamesModule],
  controllers: [ScoresController],
  providers: [ScoresService],
  exports: [ScoresService],
})
export class ScoresModule {}
