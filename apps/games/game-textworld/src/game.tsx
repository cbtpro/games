import { defineGame } from '@games/sdk';
import type { GameResult } from '@games/shared';
import App from './App';

const INITIAL_LIVES = 3;

/**
 * ⬇⬇⬇ 新游戏只需要改这个文件 + App.tsx ⬇⬇⬇
 *
 * 每个钩子都是可选的：即使一个都不实现，父应用的钩子依旧会被触发，
 * 因为事件由 SDK 统一派发（开闭原则 —— 新增玩法无需改动平台代码）。
 */
export default defineGame({
  manifest: {
    code: 'game-textworld',
    name: '文字世界',
    version: '1.0.0',
    description: '实时语音驱动的动态文字世界：每句话变成一块文字，在二维空间里生长、拐弯、拼接',
    category: 'creative',
    minPlayers: 1,
    maxPlayers: 1,
    capabilities: [
      'init',
      'mount',
      'unmount',
      'activate',
      'deactivate',
      'start',
      'pause',
      'resume',
      'death',
      'restart',
      'end',
    ],
  },

  hooks: {
    // ---------------------------------------------------------- 初始化
    async onInit(ctx) {
      ctx.logger.info('收到父应用参数', ctx.config);
      ctx.store.set('lives', INITIAL_LIVES);
      ctx.store.set('score', 0);
      // 这里适合做：读取配置、预加载素材、建立 WebSocket 等
    },

    // ---------------------------------------------------------- 挂载
    async onMount(ctx) {
      ctx.logger.info('已挂载，容器尺寸', ctx.container?.clientWidth, ctx.container?.clientHeight);
    },

    // ---------------------------------------------------------- 销毁
    async onUnmount(ctx) {
      // 必须清理定时器 / 事件监听 / WebSocket / WebGL 上下文，否则主应用会内存泄漏
      ctx.logger.info('资源已释放');
      ctx.store.clear();
    },

    // ---------------------------------------------------------- 激活 / 去激活
    async onActivate(ctx) {
      ctx.logger.info('回到前台');
    },

    async onDeactivate(ctx) {
      ctx.logger.info('退到后台（状态保留，可被再次激活）');
    },

    // ---------------------------------------------------------- 游戏流程
    async onStart(ctx) {
      ctx.logger.info('文字世界开始生长，难度 =', ctx.config.difficulty);
    },

    async onPause(_ctx, reason) {
      _ctx.logger.info('游戏暂停，原因 =', reason);
    },

    async onResume(ctx) {
      ctx.logger.info('游戏继续');
    },

    async onDeath(ctx, payload) {
      const lives = (ctx.store.get<number>('lives') ?? INITIAL_LIVES) - 1;
      ctx.store.set('lives', lives);
      ctx.logger.warn(`死亡：${payload.reason ?? 'unknown'}，剩余生命 ${lives}`);

      // 生命耗尽 -> 自动结算，父应用会收到 game:over + game:end
      if (lives <= 0) {
        await ctx.finish({
          score: ctx.store.get<number>('score') ?? 0,
          won: false,
          reason: 'no-lives',
        });
      }
    },

    async onRestart(ctx) {
      ctx.store.set('blocks', 0);
      ctx.store.set('score', 0);
      ctx.logger.info('清空文字世界，重新生长');
    },

    async onEnd(ctx, result: GameResult) {
      const blocks = ctx.store.get<number>('blocks') ?? 0;
      // 结算：把分数交给父应用，父应用的 onGameEnd 钩子会负责落库
      ctx.reportScore({
        score: result.score ?? blocks,
        mode: 'total',
        stats: { blocks, ...(result.stats ?? {}) },
      });
      ctx.logger.info('本局结算', result);
    },

    // ---------------------------------------------------------- 参数 / 异常 / 命令
    async onConfigUpdate(ctx, next, prev) {
      ctx.logger.info('父应用更新了参数', { from: prev.difficulty, to: next.difficulty });
    },

    onError(ctx, error) {
      ctx.logger.error('钩子执行失败', error);
    },

    async onCommand(ctx, command) {
      ctx.logger.info('收到父应用自定义命令', command);
    },
  },

  // React 视图；不写 render 也可以，纯 Canvas / DOM 游戏一样能跑
  render: () => <App />,
});
