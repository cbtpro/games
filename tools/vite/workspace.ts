import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * monorepo 仓库根目录：向上逐级查找 pnpm-workspace.yaml。
 * 找不到时兜底为当前文件往上三级（apps/<app> -> 根）。
 */
function findRepoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

const REPO_ROOT = findRepoRoot();

/**
 * workspace 内部包在开发期一律解析到 TypeScript 源码：
 * 免去「先 build:libs 再调试」的心智负担，改包即刻热更新。
 */
export const WORKSPACE_ALIAS: Record<string, string> = {
  '@games/shared': resolve(REPO_ROOT, 'packages/shared/src'),
  '@games/sdk': resolve(REPO_ROOT, 'packages/sdk/src'),
  '@games/ai': resolve(REPO_ROOT, 'packages/ai/src'),
};

/** 展开成 vite 的 resolve 配置 */
export const workspaceResolve = {
  alias: { ...WORKSPACE_ALIAS },
};

export const repoRoot = REPO_ROOT;
