import { HOST_PRESENCE_FLAG } from '@games/shared';

let marked = false;

/**
 * 在真实 window 上声明「本页是宿主」。
 *
 * 必须在加载任何子应用**之前**调用，子应用据此判断自己是否被托管。
 * 有了这个标记，就不必依赖 qiankun 沙箱里那个时序不确定的
 * `__POWERED_BY_QIANKUN__` —— 判断永远稳定。
 */
export function markHostPresence(): void {
  if (marked) return;
  (window as unknown as Record<string, unknown>)[HOST_PRESENCE_FLAG] = true;
  marked = true;
}
