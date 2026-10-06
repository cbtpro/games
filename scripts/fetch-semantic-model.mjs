#!/usr/bin/env node
/**
 * 下载「喂蜘蛛」用的语义模型到子应用的静态目录。
 *
 * 模型随应用分发后，玩家打开游戏即可本地加载，不必依赖 Hugging Face；
 * 不下载也能玩 —— 代码会从 HF 拉取，只是首次慢一些（且失败会自动降级为规则判定）。
 *
 * 用法：
 *   node scripts/fetch-semantic-model.mjs
 *   node scripts/fetch-semantic-model.mjs --mirror    # 走 hf-mirror.com（国内更快）
 *   node scripts/fetch-semantic-model.mjs --dtype q4  # 更小但精度略低
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'Xenova/multilingual-e5-small';
const FILES = [
  'onnx/model_int8.onnx',
  'tokenizer.json',
  'tokenizer_config.json',
  'config.json',
  'special_tokens_map.json',
];

const args = process.argv.slice(2);
const useMirror = args.includes('--mirror');
const dtypeIndex = args.indexOf('--dtype');
const dtype = dtypeIndex >= 0 ? args[dtypeIndex + 1] : 'int8';

const host = useMirror ? 'https://hf-mirror.com' : 'https://huggingface.co';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'apps/games/game-spider/public/models', REPO);

if (dtype !== 'int8') {
  FILES[0] = `onnx/model_${dtype}.onnx`;
}

console.log(`模型: ${REPO} (${dtype})`);
console.log(`来源: ${host}`);
console.log(`目标: ${target}\n`);

let total = 0;
for (const file of FILES) {
  const url = `${host}/${REPO}/resolve/main/${file}`;
  const out = join(target, file);
  mkdirSync(dirname(out), { recursive: true });

  process.stdout.write(`  ${file.padEnd(28)}`);
  try {
    execFileSync(
      'curl',
      ['-sL', '--retry', '5', '--retry-delay', '2', '--retry-all-errors', '-C', '-', '-o', out, url],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const size = statSync(out).size;
    total += size;
    console.log(`${(size / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    console.log(`失败：${String(error).slice(0, 80)}`);
    console.log('\n可改用镜像重试：node scripts/fetch-semantic-model.mjs --mirror');
    process.exitCode = 1;
  }
}

console.log(`\n合计 ${(total / 1024 / 1024).toFixed(1)} MB`);
console.log('启动游戏时设置 VITE_HF_LOCAL=true 即可优先使用本地模型。');
