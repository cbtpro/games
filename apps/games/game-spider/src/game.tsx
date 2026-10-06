import { defineGame } from '@games/sdk';
import type { GameResult } from '@games/shared';
import App from './App';

const INITIAL_PATIENCE = 3;

/** 死法说明，父应用与结算面板共用 */
const DEATH_REASON_TEXT: Record<string, string> = {
  starved: '饿到失控，把玩家当成了点心',
  'no-patience': '被敷衍的文字磨光了耐心',
};

/**
 * ⬇⬇⬇ 新游戏只需要改这个文件 + App.tsx ⬇⬇⬇
 *
 * 每个钩子都是可选的：即使一个都不实现，父应用的钩子依旧会被触发，
 * 因为事件由 SDK 统一派发（开闭原则 —— 新增玩法无需改动平台代码）。
 *
 * 本游戏的钩子只做「状态与数据的进出」，玩法细节全在 App / domain / hooks 里。
 */
export default defineGame({
  manifest: {
    code: 'game-spider',
    name: '喂蜘蛛',
    version: '1.0.0',
    description: '一只 SVG 八足蜘蛛在场地里爬行觅食，只吃有意味的文字，越吃越挑食',
    category: 'text',
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
      ctx.logger.info('蜘蛛醒了，父应用参数', ctx.config);
      ctx.store.set('score', 0);
      ctx.store.set('eaten', []);
      ctx.store.set('patience', INITIAL_PATIENCE);
      ctx.store.set('hp', 100);
      ctx.store.set('hunger', 0);
    },

    // ---------------------------------------------------------- 挂载
    async onMount(ctx) {
      ctx.logger.info('场地尺寸', ctx.container?.clientWidth, ctx.container?.clientHeight);
    },

    // ---------------------------------------------------------- 销毁
    async onUnmount(ctx) {
      // 动画帧、ResizeObserver、克隆节点都由各 hook 自行清理，这里只清数据
      ctx.logger.info('蜘蛛收摊，资源已释放');
      ctx.store.clear();
    },

    // ---------------------------------------------------------- 激活 / 去激活
    async onActivate(ctx) {
      ctx.logger.info('回到前台，继续爬');
    },

    async onDeactivate(ctx) {
      ctx.logger.info('退到后台，暂停动画帧');
    },

    // ---------------------------------------------------------- 游戏流程
    async onStart(ctx) {
      ctx.logger.info('开始觅食，难度 =', ctx.config.difficulty);
    },

    async onPause(_ctx, reason) {
      _ctx.logger.info('原地不动，原因 =', reason);
    },

    async onResume(ctx) {
      ctx.logger.info('继续找吃的');
    },

    async onDeath(ctx, payload) {
      const score = ctx.store.get<number>('score') ?? 0;
      const reason = payload.reason ?? 'unknown';
      const detail = DEATH_REASON_TEXT[reason] ?? '力竭';
      ctx.logger.warn(`${detail}（${reason}），本局 ${score} 分`);
      ctx.reportScore({
        score,
        mode: 'total',
        label: detail,
        stats: { died: true, reason },
      });
    },

    async onRestart(ctx) {
      ctx.store.set('score', 0);
      ctx.store.set('eaten', []);
      ctx.store.set('patience', INITIAL_PATIENCE);
      ctx.store.set('hp', 100);
      ctx.store.set('hunger', 0);
      ctx.logger.info('换一只饿肚子的蜘蛛，生命值回到满格');
    },

    async onEnd(ctx, result: GameResult) {
      const score = result.score ?? ctx.store.get<number>('score') ?? 0;
      const eaten = ctx.store.get<string[]>('eaten') ?? [];
      ctx.reportScore({
        score,
        mode: 'total',
        stats: { eatenCount: eaten.length, lastWords: eaten.slice(-3).join(' / ') },
      });
      ctx.logger.info('本局结算', result);
    },

    // ---------------------------------------------------------- 参数 / 异常 / 命令
    async onConfigUpdate(ctx, next, prev) {
      ctx.logger.info('父应用调整了难度', { from: prev.difficulty, to: next.difficulty });
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
