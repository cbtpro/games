#!/usr/bin/env node
/**
 * 从 game-template 复制出一个新游戏子项目。
 *
 *   pnpm new:game snake
 *
 * 会做四件事：
 *   1. 复制模板目录（排除 node_modules / dist）
 *   2. 重命名 package.json、替换 manifest.code
 *   3. 自动分配 dev / preview 端口，避免和其它子游戏冲突
 *   4. 提示把新游戏登记到后端的 GAME_SEEDS
 */
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'apps', 'games', 'game-template');
const GAMES_DIR = join(ROOT, 'apps', 'games');

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function replaceAll(text, from, to) {
  return text.split(from).join(to);
}

/** 扫描已有子游戏的端口，分配新的，避免冲突 */
function allocatePorts() {
  const used = new Set();
  for (const entry of readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const configPath = join(GAMES_DIR, entry.name, 'vite.config.ts');
    if (!existsSync(configPath)) continue;
    const text = readFileSync(configPath, 'utf8');
    for (const match of text.matchAll(/(\d{4,5})/g)) {
      used.add(Number(match[1]));
    }
  }
  let dev = 7101;
  while (used.has(dev)) dev += 1;
  return { dev, preview: dev + 100 };
}

const rawName = process.argv[2];
if (!rawName) {
  fail('用法: pnpm new:game <game-code>（小写字母、数字与连字符，例如 snake-io）');
}

const code = rawName.startsWith('game-') ? rawName : `game-${rawName}`;
if (!NAME_RE.test(code)) fail(`游戏编码不合法: ${code}`);

const target = join(GAMES_DIR, code);
if (existsSync(target)) fail(`目录已存在: apps/games/${code}`);
if (!existsSync(TEMPLATE)) fail('模板不存在: apps/games/game-template');

const { dev, preview } = allocatePorts();
const displayName = code.replace(/^game-/, '').replace(/-/g, ' ');

console.log(`➜ 复制模板 -> apps/games/${code}`);
cpSync(TEMPLATE, target, {
  recursive: true,
  filter: (src) => !/(node_modules|dist|\.vite)$/.test(basename(src)),
});

/** 逐个文件做文本替换 */
const edits = [
  ['package.json', (t) => replaceAll(t, '"name": "game-template"', `"name": "${code}"`)],
  [
    'vite.config.ts',
    (t) =>
      replaceAll(
        replaceAll(t, "'game-template'", `'${code}'`),
        /const DEV_PORT = \d+;\nconst PREVIEW_PORT = \d+;/,
        `const DEV_PORT = ${dev};\nconst PREVIEW_PORT = ${preview};`,
      ),
  ],
  [
    'src/game.tsx',
    (t) =>
      replaceAll(
        replaceAll(t, "code: 'game-template'", `code: '${code}'`),
        "name: '空白游戏模板'",
        `name: '${displayName}'`,
      ),
  ],
  ['index.html', (t) => replaceAll(t, '空白游戏模板', displayName)],
];

for (const [file, transform] of edits) {
  const path = join(target, file);
  if (!existsSync(path)) continue;
  writeFileSync(path, transform(readFileSync(path, 'utf8')));
}

writeFileSync(
  join(target, 'README.md'),
  `# ${displayName}（${code}）

由 \`pnpm new:game\` 从空白模板生成。

- 独立调试：\`pnpm --filter ${code} dev\` → http://127.0.0.1:${dev}
- 生产预览：\`pnpm --filter ${code} preview\` → http://127.0.0.1:${preview}
- 被主应用加载：先启动本子应用（dev）或 preview（prod），再从主应用打开

开发入口：

- \`src/game.tsx\` —— 生命周期钩子（onStart / onPause / onDeath / onRestart / onEnd …）
- \`src/App.tsx\` —— React 玩法界面，用 \`useGame()\` 拿上下文
`,
);

console.log(`✅ 已创建 apps/games/${code}`);
console.log(`   dev 端口: ${dev}    preview 端口: ${preview}`);
console.log('\n下一步：把新游戏登记到后端 apps/server/src/seed/seed.service.ts 的 GAME_SEEDS：');
console.log(`   {`);
console.log(`     code: '${code}',`);
console.log(`     name: '${displayName}',`);
console.log(`     entryDev: 'http://localhost:${dev}',`);
console.log(`     entryProd: 'http://localhost:${preview}',`);
console.log(`   },`);
console.log('\n然后执行：pnpm install && pnpm dev');
