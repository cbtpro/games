/** 父应用打开子游戏时传入的启动参数（可扩展，未知字段走 `params` 通道） */
export interface GameLaunchConfig {
  /** 游戏唯一编码，例如 game-template */
  gameCode: string;
  /** 平台侧游戏主键 */
  gameId: string;
  /** 本次打开的会话 ID，父应用生成，用于串联日志/分数 */
  sessionId: string;
  playerId?: string;
  playerName?: string;
  locale?: string;
  theme?: 'light' | 'dark';
  difficulty?: 'easy' | 'normal' | 'hard';
  soundEnabled?: boolean;
  /** 后端 API 基址，例如 /api */
  apiBaseUrl?: string;
  authToken?: string;
  /** 特性开关 */
  features?: Record<string, boolean | string | number>;
  /** 业务自定义参数，新游戏无需改动契约即可扩展 */
  params?: Record<string, unknown>;

  [key: string]: unknown;
}

export type GameLaunchConfigPatch = Partial<GameLaunchConfig>;

/** 默认启动参数，保证子应用永远拿不到 undefined 的必填字段 */
export const DEFAULT_LAUNCH_CONFIG: GameLaunchConfig = {
  gameCode: 'unknown',
  gameId: 'unknown',
  sessionId: 'unknown',
  theme: 'light',
  locale: 'zh-CN',
  difficulty: 'normal',
  soundEnabled: true,
};

export function mergeLaunchConfig(
  base: GameLaunchConfig,
  patch?: GameLaunchConfigPatch | null,
): GameLaunchConfig {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    features: { ...(base.features ?? {}), ...(patch.features ?? {}) },
    params: { ...(base.params ?? {}), ...(patch.params ?? {}) },
  };
}
