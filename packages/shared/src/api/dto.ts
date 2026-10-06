/** 前后端 API 契约。前端只依赖这些 DTO，后端实体变更不直接影响前端。 */

export type GameStatus = 'draft' | 'published' | 'offline';

export interface GameDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  cover: string | null;
  version: string;
  status: GameStatus;
  /** 开发环境下的子应用入口（vite dev server） */
  entryDev: string;
  /** 生产环境下的子应用入口 */
  entryProd: string;
  minPlayers: number;
  maxPlayers: number;
  /** 平台下发的默认启动参数，会被父应用表单覆盖 */
  defaultConfig: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameDto {
  code: string;
  name: string;
  description?: string | null;
  category?: string | null;
  cover?: string | null;
  version?: string;
  status?: GameStatus;
  entryDev: string;
  entryProd: string;
  minPlayers?: number;
  maxPlayers?: number;
  defaultConfig?: Record<string, unknown> | null;
}

export type UpdateGameDto = Partial<CreateGameDto>;

export interface PlayerDto {
  id: string;
  nickname: string;
  avatar: string | null;
  createdAt: string;
}

export interface CreatePlayerDto {
  nickname: string;
  avatar?: string | null;
}

export type SessionStatus = 'created' | 'running' | 'paused' | 'ended' | 'aborted';

export interface GameSessionDto {
  id: string;
  gameId: string;
  gameCode: string;
  playerId: string | null;
  status: SessionStatus;
  config: Record<string, unknown> | null;
  finalScore: number | null;
  startedAt: string | null;
  endedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface CreateSessionDto {
  gameCode: string;
  playerId?: string | null;
  config?: Record<string, unknown> | null;
}

export interface UpdateSessionDto {
  status?: SessionStatus;
  finalScore?: number | null;
  endedAt?: string | null;
  durationMs?: number | null;
}

export interface ScoreRecordDto {
  id: string;
  gameId: string;
  gameCode: string;
  playerId: string | null;
  sessionId: string | null;
  score: number;
  level: number | null;
  durationMs: number | null;
  stats: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateScoreDto {
  gameCode: string;
  playerId?: string | null;
  sessionId?: string | null;
  score: number;
  level?: number | null;
  durationMs?: number | null;
  stats?: Record<string, unknown> | null;
}

/** 生命周期事件埋点 */
export interface GameEventLogDto {
  id: string;
  gameCode: string;
  sessionId: string | null;
  type: string;
  phase: string;
  state: string | null;
  durationMs: number | null;
  payload: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

export interface CreateEventLogDto {
  gameCode: string;
  sessionId?: string | null;
  type: string;
  phase: string;
  state?: string | null;
  durationMs?: number | null;
  payload?: Record<string, unknown> | null;
  error?: string | null;
}

export interface CreateEventLogBatchDto {
  items: CreateEventLogDto[];
}

/** 统一响应包装 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
