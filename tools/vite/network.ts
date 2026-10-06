import { networkInterfaces } from 'node:os';

/** 子应用资源使用可远程访问的地址；可通过 VITE_PUBLIC_HOST 指定网卡 IP 或域名。 */
export function devOrigin(port: number): string {
  const interfaces = networkInterfaces();
  const addresses = [
    ...(interfaces.en0 ?? []),
    ...Object.values(interfaces).flatMap((items) => items ?? []),
  ];
  const host =
    process.env.VITE_PUBLIC_HOST ??
    addresses.find((address) => address.family === 'IPv4' && !address.internal)?.address ??
    '127.0.0.1';
  return `https://${host}:${port}`;
}
