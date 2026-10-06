import { bootstrapMicroApp } from '@games/sdk';
import game from './game';
import './styles.css';

/**
 * 子应用的全部入口逻辑都在 SDK 里托管：
 * - 被主应用加载时，由 qiankun 驱动 bootstrap/mount/unmount/update；
 * - 独立访问 http://127.0.0.1:7102 时，用 StandaloneHostBridge 自行挂载并自动开局。
 *
 * 新游戏照抄这一行即可，不需要理解 qiankun 细节。
 */
bootstrapMicroApp(game, {
  standaloneContainer: '#game-root',
  standaloneConfig: {
    playerName: '独立调试玩家',
    difficulty: 'normal',
    params: { theme: 'light' },
  },
});
