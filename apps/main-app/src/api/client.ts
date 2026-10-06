import type {
  ApiResponse,
  CreateScoreDto,
  CreateSessionDto,
  GameDto,
  GameSessionDto,
  PlayerDto,
} from '@games/shared';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as ApiResponse<T> | T;
  // 兼容两种响应形状：包装过 { code, data } 与裸数据
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    const wrapped = body as ApiResponse<T>;
    if (wrapped.code !== 0) throw new Error(wrapped.message || '请求失败');
    return wrapped.data;
  }
  return body as T;
}

/** 上报类请求失败不能影响游戏进行，统一静默 */
async function fireAndForget<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    return await request<T>(path, init);
  } catch (error) {
    console.warn('[api] 上报失败', error);
    return null;
  }
}

export interface EventLogInput {
  gameCode: string;
  sessionId?: string | null;
  type: string;
  phase: string;
  state?: string | null;
  durationMs?: number | null;
  payload?: unknown;
  error?: string | null;
}

export const api = {
  listGames(): Promise<GameDto[]> {
    return request<GameDto[]>('/games');
  },

  getGame(code: string): Promise<GameDto> {
    return request<GameDto>(`/games/${encodeURIComponent(code)}`);
  },

  ensurePlayer(nickname: string): Promise<PlayerDto> {
    return request<PlayerDto>('/players', {
      method: 'POST',
      body: JSON.stringify({ nickname }),
    });
  },

  createSession(dto: CreateSessionDto): Promise<GameSessionDto> {
    return request<GameSessionDto>('/sessions', { method: 'POST', body: JSON.stringify(dto) });
  },

  updateSession(
    id: string,
    dto: { status?: string; finalScore?: number | null; durationMs?: number | null },
  ): Promise<GameSessionDto> {
    return request<GameSessionDto>(`/sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },

  submitScore(dto: CreateScoreDto) {
    return fireAndForget('/scores', { method: 'POST', body: JSON.stringify(dto) });
  },

  uploadEvents(items: EventLogInput[]) {
    if (!items.length) return Promise.resolve(null);
    return fireAndForget('/events/batch', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  health(): Promise<{ status: string; database: string }> {
    return request('/health');
  },
};
