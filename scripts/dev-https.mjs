import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, 'certs');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const cert = join(dir, 'server.pem'),
  key = join(dir, 'server-key.pem');
if (existsSync(cert) && existsSync(key)) process.exit(0);
const lock = join(dir, '.generate-lock');
let locked = false;
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    mkdirSync(lock);
    locked = true;
    break;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (existsSync(cert) && existsSync(key)) process.exit(0);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}
if (!locked) throw new Error('证书生成锁等待超时，请确认没有生成任务后删除 certs/.generate-lock');
try {
  if (existsSync(cert) && existsSync(key)) process.exitCode = 0;
  else {
    const ca = join(dir, 'root-ca.pem'),
      caKey = join(dir, 'root-ca-key.pem');
    const run = (args) => execFileSync('openssl', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const config = join(dir, 'openssl.cnf');
    const names = new Set(['localhost']);
    const ips = new Set([
      '127.0.0.1',
      '::1',
      ...Object.values(networkInterfaces()).flatMap((items) =>
        (items ?? []).filter((item) => !item.internal).map((item) => item.address),
      ),
    ]);
    if (process.env.VITE_PUBLIC_HOST) {
      const host = process.env.VITE_PUBLIC_HOST;
      if (!/^[a-zA-Z0-9.:_-]+$/.test(host)) throw new Error('VITE_PUBLIC_HOST 必须是 IP 或主机名');
      (/^[\d.]+$/.test(host) || host.includes(':') ? ips : names).add(host);
    }
    writeFileSync(
      config,
      `[req]\ndistinguished_name=dn\n[dn]\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n[server]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=@san\n[san]\n${[...names].map((name, i) => `DNS.${i + 1}=${name}`).join('\n')}\n${[...ips].map((ip, i) => `IP.${i + 1}=${ip}`).join('\n')}\n`,
      { mode: 0o600 },
    );
    if (!existsSync(ca) || !existsSync(caKey))
      run([
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        caKey,
        '-out',
        ca,
        '-days',
        '3650',
        '-subj',
        '/CN=Games Local Development CA',
        '-config',
        config,
        '-extensions',
        'ca',
      ]);
    const csr = join(dir, 'server.csr');
    run([
      'req',
      '-new',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      csr,
      '-subj',
      '/CN=localhost',
    ]);
    run([
      'x509',
      '-req',
      '-in',
      csr,
      '-CA',
      ca,
      '-CAkey',
      caKey,
      '-CAcreateserial',
      '-out',
      cert,
      '-days',
      '365',
      '-extfile',
      config,
      '-extensions',
      'server',
    ]);
    rmSync(csr);
    console.log('已生成本地 HTTPS 证书。请在访问设备上安装并信任 certs/root-ca.pem。');
  }
} catch (error) {
  rmSync(cert, { force: true });
  throw error;
} finally {
  rmSync(lock, { recursive: true, force: true });
}
