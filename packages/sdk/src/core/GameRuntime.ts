import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  canTransition,
  GAME_COMMANDS,
  GAME_EVENTS,
  GameState,
  mergeLaunchConfig,
  serializeError,
  type DeathPayload,
  type GameCommand,
  type GameContext,
  type GameEvent,
  type GameEventBus,
  type GameEventName,
  type GameEventType,
  type GameHostApi,
  type GameLaunchConfig,
  type GameLaunchConfigPatch,
  type GameLogger,
  type GameResult,
  type GameStore,
  type PauseReason,
  type ScorePayload,
  type Unsubscribe,
} from '@games/shared';
import { EventBus } from '../bus/EventBus';
import { MemoryStore } from '../store/MemoryStore';
import { createLogger } from '../logger/createLogger';
import { GameProvider } from '../react/GameProvider';
import type { GameDefinition } from '../types';

/** 事件可读名，控制台展示用 */
const EVENT_LABELS: Record<string, string> = {
  [GAME_EVENTS.INIT]: '初始化',
  [GAME_EVENTS.MOUNT]: '挂载',
  [GAME_EVENTS.UNMOUNT]: '销毁',
  [GAME_EVENTS.ACTIVATE]: '激活',
  [GAME_EVENTS.DEACTIVATE]: '去激活',
  [GAME_EVENTS.START]: '游戏开始',
  [GAME_EVENTS.PAUSE]: '游戏暂停',
  [GAME_EVENTS.RESUME]: '游戏继续',
  [GAME_EVENTS.DEATH]: '死亡',
  [GAME_EVENTS.RESTART]: '重开',
  [GAME_EVENTS.OVER]: '游戏结束',
  [GAME_EVENTS.END]: '结算',
  [GAME_EVENTS.SCORE]: '分数上报',
  [GAME_EVENTS.STATE_CHANGE]: '状态变更',
  [GAME_EVENTS.ERROR]: '异常',
};

interface RunHookOptions<P> {
  event: GameEventName;
  /** 执行前进入的状态 */
  to?: GameState;
  /** 执行成功后进入的状态 */
  settled?: GameState;
  payload?: P;
  /** 不传表示只派发事件、不调用业务钩子 */
  invoke?: () => void | Promise<void>;
  label?: string;
}

type DispatchInput = Partial<GameEvent> &
  Pick<GameEvent, 'type' | 'phase'> & { payload?: unknown };

/**
 * 生命周期编排器。
 *
 * 职责单一：把「状态机 + 事件派发 + 钩子调用 + 异常兜底 + 并发串行化」收敛到一处。
 * 新游戏只需实现自己的钩子，不重复这套机制（开闭原则）。
 */
export class GameRuntime<C extends GameLaunchConfig = GameLaunchConfig>
  implements GameContext<C>
{
  readonly manifest: GameDefinition<C>['manifest'];
  readonly host: GameHostApi;
  readonly bus: GameEventBus = new EventBus();
  readonly store: GameStore = new MemoryStore();
  readonly logger: GameLogger;

  private readonly definition: GameDefinition<C>;
  private readonly launchConfig: C;
  private currentState: GameState = GameState.Idle;
  private domContainer: HTMLElement | null = null;
  private reactRoot: Root | null = null;
  private unsubscribeCommand: Unsubscribe | null = null;
  private destroyed = false;

  /** 串行队列：并发命令按序执行，避免竞态（鲁棒性关键） */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(definition: GameDefinition<C>, config: C, host: GameHostApi) {
    this.definition = definition;
    this.manifest = definition.manifest;
    this.launchConfig = config;
    this.host = host;
    this.logger = createLogger({ prefix: `[game:${definition.manifest.code}]` });

    this.unsubscribeCommand = host.onCommand((command) => {
      void this.enqueue(() => this.handleCommand(command));
    });
  }

  // ------------------------------------------------------------ GameContext

  get config(): Readonly<C> {
    return this.launchConfig;
  }

  get state(): GameState {
    return this.currentState;
  }

  get container(): HTMLElement | null {
    return this.domContainer;
  }

  get isEmbedded(): boolean {
    return this.host.isEmbedded();
  }

  readonly render = (node: ReactNode): void => {
    const container = this.domContainer;
    if (!container) {
      throw new Error('尚未挂载容器，无法渲染。请先调用 attachContainer()');
    }
    if (!this.reactRoot) {
      this.reactRoot = createRoot(container);
    }
    const ctx = this as unknown as GameContext<GameLaunchConfig>;
    this.reactRoot.render(createElement(GameProvider, { ctx, children: node }));
  };

  readonly clear = (): void => {
    const root = this.reactRoot;
    this.reactRoot = null;
    if (root) {
      try {
        root.unmount();
      } catch (error) {
        this.logger.warn('React 树卸载失败', error);
      }
    }
    if (this.domContainer) {
      this.domContainer.innerHTML = '';
    }
  };

  readonly emit = <T = unknown>(type: GameEventType, payload?: T): void => {
    this.dispatch({
      type,
      phase: 'after',
      label: EVENT_LABELS[type] ?? String(type),
      payload,
    });
  };

  readonly reportScore = (payload: ScorePayload): void => {
    this.host.reportScore(payload);
    this.emit(GAME_EVENTS.SCORE, payload);
  };

  readonly sendCommand = (command: GameCommand): void => {
    this.emit(`game:custom:command`, command);
  };

  readonly start = (): Promise<void> => this.enqueue(() => this.doStart());
  readonly pause = (reason?: PauseReason): Promise<void> =>
    this.enqueue(() => this.doPause(reason));
  readonly resume = (): Promise<void> => this.enqueue(() => this.doResume());
  readonly die = (payload: DeathPayload = {}): Promise<void> =>
    this.enqueue(() => this.doDeath(payload));
  readonly restart = (): Promise<void> => this.enqueue(() => this.doRestart());
  readonly finish = (result: GameResult): Promise<void> => this.enqueue(() => this.doEnd(result));
  readonly patchConfig = (patch: GameLaunchConfigPatch): Promise<void> =>
    this.enqueue(() => this.doConfigUpdate(patch));

  // ------------------------------------------------------------ 生命周期入口

  /** qiankun bootstrap：只初始化，不碰 DOM */
  init(): Promise<void> {
    return this.enqueue(() => this.doInit());
  }

  /** qiankun mount */
  mount(): Promise<void> {
    return this.enqueue(() => this.doMount());
  }

  /** qiankun unmount */
  unmount(): Promise<void> {
    return this.enqueue(() => this.doUnmount());
  }

  activate(): Promise<void> {
    return this.enqueue(() => this.doActivate());
  }

  deactivate(): Promise<void> {
    return this.enqueue(() => this.doDeactivate());
  }

  attachContainer(container: HTMLElement | null | undefined): void {
    if (container) this.domContainer = container;
  }

  /** 仅测试 / 调试用：读取内部串行队列 */
  idle(): Promise<unknown> {
    return this.queue;
  }

  // ------------------------------------------------------------ 各阶段实现

  private async doInit(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.INIT,
      to: GameState.Initializing,
      settled: GameState.Initialized,
      invoke: () => this.definition.hooks?.onInit?.(this),
    });
  }

  private async doMount(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.MOUNT,
      to: GameState.Mounting,
      settled: GameState.Mounted,
      invoke: async () => {
        if (this.definition.render) {
          this.render(this.definition.render(this));
        }
        await this.definition.hooks?.onMount?.(this);
      },
    });
  }

  private async doUnmount(): Promise<void> {
    if (this.destroyed) return;
    await this.runHook({
      event: GAME_EVENTS.UNMOUNT,
      to: GameState.Destroying,
      settled: GameState.Destroyed,
      invoke: async () => {
        await this.definition.hooks?.onUnmount?.(this);
        this.clear();
        this.teardown();
      },
    });
  }

  private async doActivate(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.ACTIVATE,
      settled: GameState.Activated,
      invoke: () => this.definition.hooks?.onActivate?.(this),
    });
  }

  private async doDeactivate(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.DEACTIVATE,
      settled: GameState.Deactivated,
      invoke: () => this.definition.hooks?.onDeactivate?.(this),
    });
  }

  private async doStart(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.START,
      settled: GameState.Running,
      invoke: () => this.definition.hooks?.onStart?.(this),
    });
  }

  private async doPause(reason?: PauseReason): Promise<void> {
    const finalReason = reason ?? 'user';
    await this.runHook({
      event: GAME_EVENTS.PAUSE,
      settled: GameState.Paused,
      payload: { reason: finalReason },
      invoke: () => this.definition.hooks?.onPause?.(this, finalReason),
    });
  }

  private async doResume(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.RESUME,
      settled: GameState.Running,
      invoke: () => this.definition.hooks?.onResume?.(this),
    });
  }

  private async doDeath(payload: DeathPayload): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.DEATH,
      settled: GameState.Over,
      payload,
      invoke: () => this.definition.hooks?.onDeath?.(this, payload),
    });
  }

  private async doRestart(): Promise<void> {
    await this.runHook({
      event: GAME_EVENTS.RESTART,
      to: GameState.Running,
      settled: GameState.Running,
      invoke: () => this.definition.hooks?.onRestart?.(this),
    });
  }

  private async doEnd(result: GameResult): Promise<void> {
    // 先广播「结束」事件，父应用可在此时锁分；再调用结算钩子
    await this.runHook<GameResult>({
      event: GAME_EVENTS.OVER,
      settled: GameState.Over,
      payload: result,
    });
    await this.runHook<GameResult>({
      event: GAME_EVENTS.END,
      payload: result,
      invoke: () => this.definition.hooks?.onEnd?.(this, result),
    });
  }

  private async doConfigUpdate(patch: GameLaunchConfigPatch): Promise<void> {
    const prev = { ...this.launchConfig } as C;
    const next = mergeLaunchConfig(this.launchConfig, patch) as C;
    Object.assign(this.launchConfig, next);
    await this.runHook({
      event: GAME_EVENTS.STATE_CHANGE,
      label: '参数更新',
      payload: { prev, next },
      invoke: () => this.definition.hooks?.onConfigUpdate?.(this, next, prev),
    });
  }

  private async handleCommand(command: GameCommand): Promise<void> {
    if (this.destroyed) return;
    switch (command.type) {
      case GAME_COMMANDS.START:
        return this.doStart();
      case GAME_COMMANDS.PAUSE:
        return this.doPause((command.payload as { reason?: PauseReason } | undefined)?.reason);
      case GAME_COMMANDS.RESUME:
        return this.doResume();
      case GAME_COMMANDS.RESTART:
        return this.doRestart();
      case GAME_COMMANDS.STOP:
        return this.doEnd((command.payload as GameResult | undefined) ?? {
          score: 0,
          reason: 'parent-stop',
        });
      case GAME_COMMANDS.ACTIVATE:
        return this.doActivate();
      case GAME_COMMANDS.DEACTIVATE:
        return this.doDeactivate();
      case GAME_COMMANDS.UPDATE_CONFIG:
        return this.doConfigUpdate((command.payload ?? {}) as GameLaunchConfigPatch);
      case GAME_COMMANDS.DESTROY:
        return this.doUnmount();
      default:
        return this.runHook({
          event: GAME_EVENTS.STATE_CHANGE,
          label: '自定义命令',
          payload: command,
          invoke: () => this.definition.hooks?.onCommand?.(this, command),
        });
    }
  }

  // ------------------------------------------------------------ 基础设施

  private enqueue(task: () => void | Promise<void>): Promise<void> {
    const next = this.queue.then(
      () => task(),
      () => task(),
    );
    // 队列永不因单个任务失败而断裂
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async runHook<P>(options: RunHookOptions<P>): Promise<void> {
    if (this.destroyed && options.event !== GAME_EVENTS.UNMOUNT) return;

    if (options.to) this.transitionTo(options.to);
    const startedAt = Date.now();
    const label = options.label ?? EVENT_LABELS[options.event] ?? options.event;

    this.dispatch({ type: options.event, phase: 'before', label, payload: options.payload });

    try {
      if (options.invoke) await options.invoke();
      if (options.settled) this.transitionTo(options.settled);
      this.dispatch({
        type: options.event,
        phase: 'after',
        label,
        payload: options.payload,
        durationMs: Date.now() - startedAt,
      });
    } catch (rawError) {
      const error = rawError instanceof Error ? rawError : new Error(String(rawError));
      this.dispatch({
        type: GAME_EVENTS.ERROR,
        phase: 'error',
        label: `${label}失败`,
        payload: { cause: options.event, detail: options.payload },
        error: serializeError(error),
        durationMs: Date.now() - startedAt,
      });
      try {
        this.definition.hooks?.onError?.(this, error);
      } catch (handlerError) {
        this.logger.error('onError 钩子自身抛错', handlerError);
      }
    }
  }

  private transitionTo(next: GameState): void {
    const prev = this.currentState;
    if (prev === next) return;
    if (!canTransition(prev, next)) {
      // 只观测、不阻断：非法迁移上报父应用，钩子照常执行
      this.dispatch({
        type: GAME_EVENTS.ERROR,
        phase: 'error',
        label: '非法状态迁移',
        payload: { from: prev, to: next },
        error: serializeError(new Error(`非法状态迁移: ${prev} -> ${next}`)),
      });
    }
    this.currentState = next;
    this.host.notifyStateChange(prev, next);
    this.dispatch({
      type: GAME_EVENTS.STATE_CHANGE,
      phase: 'after',
      label: '状态变更',
      payload: { from: prev, to: next },
    });
  }

  private dispatch(input: DispatchInput): void {
    const event: GameEvent = {
      gameCode: this.manifest.code,
      sessionId: String(this.launchConfig.sessionId ?? 'unknown'),
      timestamp: input.timestamp ?? Date.now(),
      state: this.currentState,
      label: input.label ?? String(input.type),
      ...input,
    } as GameEvent;

    this.bus.emit(event);
    try {
      this.host.emit(event);
    } catch (error) {
      this.logger.error('事件上报父应用失败', error);
    }
  }

  private teardown(): void {
    this.destroyed = true;
    this.unsubscribeCommand?.();
    this.unsubscribeCommand = null;
    this.bus.clear();
    this.store.clear();
    this.domContainer = null;
  }
}
