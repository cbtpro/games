import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GamesService } from '../modules/games/games.service';
import { GameStatus } from '../modules/games/game.entity';

/**
 * 启动时播种。
 * 新增游戏只需往 `GAME_SEEDS` 里加一条，不必改动业务代码（开闭原则）。
 */
export interface GameSeed {
  code: string;
  name: string;
  description: string;
  category: string;
  version: string;
  entryDev: string;
  entryProd: string;
  defaultConfig?: Record<string, unknown>;
}

export const GAME_SEEDS: GameSeed[] = [
  {
    code: 'game-template',
    name: '空白游戏模板',
    description: '不含任何玩法的骨架工程，用于复制出新游戏',
    category: 'template',
    version: '1.0.0',
    entryDev: 'http://localhost:7101',
    entryProd: 'http://localhost:7201',
    defaultConfig: { difficulty: 'normal', theme: 'light', soundEnabled: true },
  },
  {
    code: 'game-spider',
    name: '喂蜘蛛',
    description: '一只 SVG 八足蜘蛛在场地里爬行觅食，只吃有意味的文字，越吃越挑食',
    category: 'text',
    version: '1.0.0',
    entryDev: 'http://localhost:7102',
    entryProd: 'http://localhost:7202',
    defaultConfig: { difficulty: 'normal', theme: 'light', soundEnabled: false },
  },
  {
    code: 'game-textworld',
    name: '文字世界',
    description: '实时语音驱动的动态文字世界：每句话变成一块文字，在二维空间里生长、拐弯、拼接',
    category: 'creative',
    version: '1.0.0',
    entryDev: 'http://localhost:7103',
    entryProd: 'http://localhost:7203',
    defaultConfig: { difficulty: 'normal', theme: 'light', soundEnabled: false },
  },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly games: GamesService) {}

  async onModuleInit(): Promise<void> {
    for (const seed of GAME_SEEDS) {
      try {
        await this.games.upsert({ ...seed, status: GameStatus.Published });
        this.logger.log(`已同步游戏: ${seed.code}`);
      } catch (error) {
        // 数据库不可用时不能阻止应用启动
        this.logger.warn(`同步游戏失败 ${seed.code}: ${(error as Error).message}`);
      }
    }
  }
}
