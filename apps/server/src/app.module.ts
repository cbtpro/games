import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { GamesModule } from './modules/games/games.module';
import { PlayersModule } from './modules/players/players.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { ScoresModule } from './modules/scores/scores.module';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { SeedService } from './seed/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig], envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<TypeOrmModuleOptions>('database') as TypeOrmModuleOptions,
    }),
    HealthModule,
    GamesModule,
    PlayersModule,
    SessionsModule,
    ScoresModule,
    EventsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
