import { EventLogStore } from './EventLogStore';
import { GameHostController } from './GameHostController';
import { markHostPresence } from './hostPresence';
import { TelemetryBuffer } from './TelemetryBuffer';
import { createEventLogHooks, createLoggingHooks, createTelemetryHooks } from './hostHooks';

// 声明宿主身份，必须在任何子应用被加载之前完成
markHostPresence();

/** 事件日志（驱动右侧控制台） */
export const eventLogStore = new EventLogStore();

/** 生命周期埋点缓冲 */
export const telemetry = new TelemetryBuffer();

/** 全局唯一的宿主控制器 */
export const gameHost = new GameHostController();

// 默认挂三套钩子：控制台输出 / 埋点上报 / 事件日志。
// 新增能力只需再 registerHooks 一套，无需改动已有代码（开闭原则）。
gameHost.registerHooks(createLoggingHooks());
gameHost.registerHooks(createTelemetryHooks(telemetry));
gameHost.registerHooks(createEventLogHooks((event) => eventLogStore.push(event)));

telemetry.start();

export { GameHostController } from './GameHostController';
export type { GameHandle } from './GameHostController';
export { EventLogStore } from './EventLogStore';
export { TelemetryBuffer } from './TelemetryBuffer';
export { CommandHub } from './CommandHub';
export { HookRegistry } from './HookRegistry';
export { ParentGameBridge } from './ParentGameBridge';
export { markHostPresence } from './hostPresence';
export * from './hostHooks';
