import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** 启动服务时生成缺失的本地证书，开发与预览共用同一证书。 */
export function localHttps() {
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('../../scripts/dev-https.mjs', import.meta.url))],
    { stdio: 'inherit' },
  );
  return {
    cert: readFileSync(new URL('../../certs/server.pem', import.meta.url)),
    key: readFileSync(new URL('../../certs/server-key.pem', import.meta.url)),
  };
}
