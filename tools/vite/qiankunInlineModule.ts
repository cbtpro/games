import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** 将内联 module 脚本转换为动态导入，兼容 qiankun 的脚本执行方式。虚拟模块地址使用子应用 publicPath。 */
const VIRTUAL_PREFIX = '/@qiankun-inline-module/';

const INLINE_MODULE_RE = /<script type="module">([\s\S]*?)<\/script>/g;

export function inlineModuleToClassicScript(): Plugin {
  const modules = new Map<string, string>();

  const buildUrlExpression = (id: string): string =>
    `(window.proxy ? (window.proxy.__INJECTED_PUBLIC_PATH_BY_QIANKUN__ + '..') : '') + ${JSON.stringify(id)}`;

  return {
    name: 'games-inline-module-to-classic',
    transformIndexHtml: {
      // 必须晚于 @vitejs/plugin-react：热更新脚本是由它在辞典阶段
      // 以 <script type="module"> 注入，因此需要在其之后转换。
      order: 'post',
      handler(html) {
        return html.replace(INLINE_MODULE_RE, (_match, code: string) => {
          if (!code.trim()) return '';
          const digest = createHash('sha1').update(code).digest('hex').slice(0, 12);
          const id = `${VIRTUAL_PREFIX}${digest}.js`;
          modules.set(id, code);
          return `<script>import(${buildUrlExpression(id)})</script>`;
        });
      },
    },
    resolveId(id) {
      return modules.has(id) ? id : null;
    },
    load(id) {
      return modules.get(id) ?? null;
    },
  };
}
