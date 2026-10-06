/**
 * 宿主存在标记。
 *
 * 背景：qiankun 的沙箱标志 `__POWERED_BY_QIANKUN__` 只在被 eval 的
 * classic script 上下文里可见；而 Vite 子应用是通过动态 import 加载的，
 * 真正的 ES 模块运行在「真实 window」里，能否看到 `window.proxy`
 * 取决于时序 —— 直接用它判断会造成「有时真的被托管、有时退回独立运行」
 * 的随机故障。
 *
 * 方案：由主应用在加载子应用**之前**，在自己的（真实）window 上盖一个
 * 确定性的标记；子应用只要认这个标记，判断就永远稳定。
 */
export const HOST_PRESENCE_FLAG = '__GAMES_PLATFORM__';

/** 宿主包名用于日志与调试时区分来源 */
export const HOST_NAME = 'games-platform';
