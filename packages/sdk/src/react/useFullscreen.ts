import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Safari 至今只实现了带前缀的全屏 API，两套都要认。
 * 这里用可选成员描述，避免为了兼容去污染全局类型。
 */
interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export interface UseFullscreenResult {
  /** 当前是否正处在「本元素」的全屏态 */
  isFullscreen: boolean;
  /** 浏览器是否支持全屏；不支持时按钮应隐藏，而不是点了才报错 */
  isSupported: boolean;
  enter: () => Promise<void>;
  exit: () => Promise<void>;
  toggle: () => Promise<void>;
}

/** 当前占据全屏的元素（兼容 Safari 前缀） */
function currentFullscreenElement(): Element | null {
  const doc = document as PrefixedDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** 特性探测：SSR / 老浏览器下返回 false，调用方据此决定要不要渲染按钮 */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const probe = document.documentElement as PrefixedElement;
  return (
    typeof probe.requestFullscreen === 'function' ||
    typeof probe.webkitRequestFullscreen === 'function'
  );
}

/** 全屏可能被浏览器策略拒绝（非用户手势、iframe 未授权等），这不算游戏内错误 */
async function enterFullscreen(element: HTMLElement): Promise<void> {
  const target = element as PrefixedElement;
  if (typeof target.requestFullscreen === 'function') {
    await target.requestFullscreen({ navigationUI: 'hide' });
    return;
  }
  target.webkitRequestFullscreen?.();
}

async function leaveFullscreen(): Promise<void> {
  const doc = document as PrefixedDocument;
  if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitFullscreenElement) {
    doc.webkitExitFullscreen?.();
  }
}

/**
 * 让任意元素进入/退出全屏。
 *
 * 设计要点：
 * - 状态以 `document.fullscreenElement` 为准，而不是自己记账，
 *   这样用户按 Esc、或宿主主动退出时 UI 也能同步；
 * - 判断「是不是我的全屏」用 `contains`，因为子应用常把全屏请求打在容器上；
 * - 组件卸载时若仍占着全屏就主动退出，避免宿主页面卡在全屏态。
 *
 * @param targetRef 要全屏的元素；传 null 时所有操作都是安全的空转
 */
export function useFullscreen(targetRef: RefObject<HTMLElement | null>): UseFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState(false);
  // 显式调用：直接把函数交给 useState 会被当成惰性初始化器
  const [isSupported] = useState(() => isFullscreenSupported());

  useEffect(() => {
    if (!isSupported) return;

    const sync = (): void => {
      const active = currentFullscreenElement();
      const target = targetRef.current;
      setIsFullscreen(!!active && !!target && (active === target || target.contains(active)));
    };

    sync();
    // 两套事件都监听：不同浏览器只触发其中一个，重复监听成本可忽略
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);

    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, [isSupported, targetRef]);

  // 卸载兜底：子应用被 qiankun 卸载时把全屏还回去
  useEffect(
    () => () => {
      const active = currentFullscreenElement();
      const target = targetRef.current;
      if (!active || !target) return;
      if (active === target || target.contains(active)) void leaveFullscreen();
    },
    [targetRef],
  );

  const guard = useCallback(async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
    } catch (error) {
      console.warn('[games-sdk] 全屏切换被浏览器拒绝：', error);
    }
  }, []);

  const enter = useCallback((): Promise<void> => {
    const target = targetRef.current;
    if (!target) return Promise.resolve();
    return guard(() => enterFullscreen(target));
  }, [guard, targetRef]);

  const exit = useCallback((): Promise<void> => guard(leaveFullscreen), [guard]);

  const toggle = useCallback((): Promise<void> => {
    const active = currentFullscreenElement();
    const target = targetRef.current;
    const mine = !!active && !!target && (active === target || target.contains(active));
    return mine ? exit() : enter();
  }, [enter, exit, targetRef]);

  return { isFullscreen, isSupported, enter, exit, toggle };
}
