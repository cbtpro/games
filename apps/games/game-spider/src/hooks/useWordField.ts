import { useCallback, useRef, useState } from 'react';
import type { WordItem } from '../domain/types';

/**
 * 场地上的文字词条管理。
 * 只负责「摆在哪里」和「谁在场」，不参与蜘蛛的任何决策。
 */

/** 同屏最多几条，超过就提示玩家先喂完地上的 */
const MAX_ITEMS = 7;
const PADDING = 24;
const EST_HEIGHT = 34;

/** 粗略估算文本宽度：中日韩字符按 1em，其余按 0.55em */
function estimateWidth(text: string): number {
  const width = [...text].reduce((total, char) => total + (/[⺀-鿿＀-￯]/.test(char) ? 15 : 8), 0);
  return Math.min(360, width + 28);
}

function overlaps(a: { x: number; y: number; w: number; h: number }, item: WordItem): boolean {
  const bw = estimateWidth(item.text);
  return !(
    a.x + a.w + 14 < item.x ||
    a.x > item.x + bw + 14 ||
    a.y + a.h + 12 < item.y ||
    a.y > item.y + EST_HEIGHT + 12
  );
}

export interface WordField {
  items: WordItem[];
  itemsRef: React.MutableRefObject<WordItem[]>;
  wordRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  register: (id: string, element: HTMLElement | null) => void;
  /** 投放一条；返回 null 表示场地已满 */
  add: (text: string, verdict: WordItem['verdict']) => WordItem | null;
  remove: (id: string) => void;
  clear: () => void;
}

export function useWordField(fieldRef: React.RefObject<HTMLElement>): WordField {
  const [items, setItems] = useState<WordItem[]>([]);
  const itemsRef = useRef<WordItem[]>([]);
  const wordRefs = useRef(new Map<string, HTMLElement>());
  const seq = useRef(0);

  itemsRef.current = items;

  const register = useCallback((id: string, element: HTMLElement | null): void => {
    if (element) wordRefs.current.set(id, element);
    else wordRefs.current.delete(id);
  }, []);

  const add = useCallback(
    (text: string, verdict: WordItem['verdict']): WordItem | null => {
      const field = fieldRef.current;
      const width = field?.clientWidth ?? 760;
      const height = field?.clientHeight ?? 440;

      if (itemsRef.current.length >= MAX_ITEMS) return null;

      const box = { x: 0, y: 0, w: estimateWidth(text), h: EST_HEIGHT };
      const maxX = Math.max(PADDING, width - box.w - PADDING);
      const maxY = Math.max(PADDING, height - EST_HEIGHT - PADDING);

      let spot: { x: number; y: number } | null = null;
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const candidate = {
          x: PADDING + Math.random() * Math.max(1, maxX - PADDING),
          y: PADDING + Math.random() * Math.max(1, maxY - PADDING),
        };
        box.x = candidate.x;
        box.y = candidate.y;
        if (!itemsRef.current.some((item) => overlaps(box, item))) {
          spot = candidate;
          break;
        }
      }
      const position = spot ?? {
        x: PADDING + Math.random() * Math.max(1, maxX - PADDING),
        y: PADDING + Math.random() * Math.max(1, maxY - PADDING),
      };

      seq.current += 1;
      const item: WordItem = {
        id: `word-${seq.current}-${Date.now().toString(36)}`,
        text,
        verdict,
        x: position.x,
        y: position.y,
        bornAt: Date.now(),
      };

      setItems((current) => [...current, item]);
      return item;
    },
    [fieldRef],
  );

  const remove = useCallback((id: string): void => {
    wordRefs.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback((): void => {
    wordRefs.current.clear();
    setItems([]);
  }, []);

  return { items, itemsRef, wordRefs, register, add, remove, clear };
}
