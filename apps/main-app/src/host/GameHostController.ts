import { loadMicroApp } from 'qiankun';
import {
  DEFAULT_LAUNCH_CONFIG,
  GAME_COMMANDS,
  GAME_EVENTS,
  GameState,
  mergeLaunchConfig,
  type GameCommand,
  type GameDto,
  type GameEvent,
  type GameHostHooks,
  type GameLaunchConfig,
  type GameResult,
  type PauseReason,
} from '@games/shared';
import { api } from '../api/client';
import { CommandHub } from './CommandHub';
import { HookRegistry } from './HookRegistry';
import { markHostPresence } from './hostPresence';
import { ParentGameBridge } from './ParentGameBridge';
import { createSessionSyncHooks } from './hostHooks';

type MicroAppInstance = ReturnType<typeof loadMicroApp>;

const randomId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 一次「打开子游戏」的句柄，父应用通过它下发命令 */
export class GameHandle {
  readonly gameCode: string;
  readonly sessionId: string;

  private app: MicroAppInstance | null = null;
  private currentState: string = GameState.Idle;
  private readonly cleanups: Array<() => void> = [];
  private readonly listeners = new Set<(event: GameEvent) => void>();

  constructor(
    gameCode: string,
    sessionId: string,
    private readonly hub: CommandHub,
  ) {
    this.gameCode = gameCode;
    this.sessionId = sessionId;
  }

  attach(app: MicroAppInstance): void {
    this.app = app;
  }

  addCleanup(fn: () => void): void {
    this.cleanups.push(fn);
  }

  onEvent(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event: GameEvent): void {
    this.currentState = event.state;
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[GameHandle] 事件监听失败', error);
      }
    });
  }

  getState(): string {
    return this.currentState;
  }

  // ---------------------------------------------------------- 命令下发

  send(command: GameCommand): void {
    this.hub.dispatch(command);
  }

  start(): void {
    this.send({ type: GAME_COMMANDS.START, source: 'host' });
  }

  pause(reason: PauseReason = 'parent'): void {
    this.send({ type: GAME_COMMANDS.PAUSE, payload: { reason }, source: 'host' });
  }

  resume(): void {
    this.send({ type: GAME_COMMANDS.RESUME, source: 'host' });
  }

  restart(): void {
    this.send({ type: GAME_COMMANDS.RESTART, source: 'host' });
  }

  stop(result?: Partial<GameResult>): void {
    this.send({
      type: GAME_COMMANDS.STOP,
      payload: { score: 0, ...(result ?? {}) },
      source: 'host',
    });
  }

  activate(): void {
    this.send({ type: GAME_COMMANDS.ACTIVATE, source: 'host' });
  }

  deactivate(): void {
    this.send({ type: GAME_COMMANDS.DEACTIVATE, source: 'host' });
  }

  updateConfig(patch: Partial<GameLaunchConfig>): void {
    this.send({ type: GAME_COMMANDS.UPDATE_CONFIG, payload: patch, source: 'host' });
  }

  /** 关闭并销毁子应用 */
  async destroy(): Promise<void> {
    if (this.app) {
      try {
        await this.app.unmount();
      } catch (error) {
        console.warn('[GameHandle] 子应用卸载失败', error);
      }
      this.app = null;
    }
    this.hub.clear();
    this.listeners.clear();
    this.cleanups.splice(0).forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn('[GameHandle] 清理失败', error);
      }
    });
    this.currentState = GameState.Destroyed;
  }
}

export interface LaunchOptions {
  game: GameDto;
  container: HTMLElement;
  /** 父应用传入子应用的启动参数 */
  config?: Partial<GameLaunchConfig>;
  /** 本次打开额外挂载的父应用钩子 */
  hooks?: GameHostHooks[];
}

/**
 * 主应用的核心：加载子游戏、注入参数、分发事件、下发命令。
 * 子应用只认 GameHostApi，主应用只认 GameEvent —— 双向解耦。
 */
export class GameHostController {
  private readonly registry = new HookRegistry();
  private readonly handles = new Map<string, GameHandle>();

  registerHooks(hooks: GameHostHooks): () => void {
    return this.registry.register(hooks);
  }

  get(gameCode: string): GameHandle | undefined {
    return this.handles.get(gameCode);
  }

  async launch(options: LaunchOptions): Promise<GameHandle> {
    // 先确保子应用能确定性地识别宿主，再开始加载
    markHostPresence();

    const { game, container, config = {} } = options;

    // 1) 先向后端开局拿 sessionId；失败也不阻塞打开（降级为本地 ID）
    let sessionId = config.sessionId ?? '';
    try {
      const session = await api.createSession({
        gameCode: game.code,
        playerId: config.playerId ?? null,
        config: config as Record<string, unknown>,
      });
      sessionId = session.id;
    } catch {
      sessionId = sessionId || randomId();
    }

    // 2) 组装传给子应用的启动参数：平台默认 < 游戏默认 < 本次传入
    const launchConfig = mergeLaunchConfig(DEFAULT_LAUNCH_CONFIG, {
      gameCode: game.code,
      gameId: game.id,
      apiBaseUrl: '/api',
      ...(game.defaultConfig ?? {}),
      ...config,
      // sessionId 放在最后，不允许被游戏默认参数或调用方覆盖
      sessionId,
    });

    // 3) 建立命令通道 + 桥 + 句柄
    const hub = new CommandHub();
    const handle = new GameHandle(game.code, sessionId, hub);

    const bridge = new ParentGameBridge(
      hub,
      (event) => {
        this.registry.dispatch(event);
        handle.notify(event);
        if (event.type === GAME_EVENTS.UNMOUNT) {
          this.handles.delete(game.code);
        }
      },
      {
        onRequestClose: () => {
          void handle.destroy().then(() => this.handles.delete(game.code));
        },
      },
    );

    const unregisterSessionHooks = this.registry.register(
      createSessionSyncHooks({ gameCode: game.code, sessionId, playerId: config.playerId ?? null }),
    );
    handle.addCleanup(unregisterSessionHooks);

    (options.hooks ?? []).forEach((set) => {
      handle.addCleanup(this.registry.register(set));
    });

    // 4) 加载子应用：开发环境走 vite dev server，生产环境走构建产物
    const configuredEntry = import.meta.env.DEV ? game.entryDev : game.entryProd;
    const entryUrl = new URL(configuredEntry, window.location.href);
    if (['localhost', '127.0.0.1', '[::1]'].includes(entryUrl.hostname)) {
      entryUrl.hostname = window.location.hostname;
      entryUrl.protocol = window.location.protocol;
    }
    const entry = entryUrl.href;
    const app = loadMicroApp(
      {
        name: game.code,
        entry,
        container,
        props: { config: launchConfig, host: bridge },
      },
      { sandbox: true, singular: false },
    );
    handle.attach(app);
    this.handles.set(game.code, handle);

    try {
      await app.mountPromise;
    } catch (error) {
      console.error('[GameHostController] 子应用挂载失败', error);
    }

    return handle;
  }

  async destroy(gameCode: string): Promise<void> {
    const handle = this.handles.get(gameCode);
    if (!handle) return;
    await handle.destroy();
    this.handles.delete(gameCode);
  }

  async destroyAll(): Promise<void> {
    await Promise.all(Array.from(this.handles.keys()).map((code) => this.destroy(code)));
  }
}
