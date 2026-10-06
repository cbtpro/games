import { memo } from 'react';
import type { WordItem } from '../domain/types';

export interface WordCardProps {
  item: WordItem;
  register: (id: string, element: HTMLElement | null) => void;
}

/**
 * 场上一条漂浮的文字。被抓取时引擎会克隆它，随后这个节点立刻销毁。
 *
 * 用 memo 包一层：生命体征每 250ms 更新一次，词条不该跟着重渲染 ——
 * 否则内联 ref 回调会被反复 detach/attach，蜘蛛正在瞄准的目标可能瞬间测不到。
 */
export const WordCard = memo(function WordCard({ item, register }: WordCardProps): JSX.Element {
  return (
    <div
      ref={(element) => {
        register(item.id, element);
      }}
      className={`sp-word sp-word--${item.verdict.grade}`}
      data-word-id={item.id}
      style={{ left: `${item.x}px`, top: `${item.y}px` }}
    >
      <span className="sp-word__text">{item.text}</span>
      {item.verdict.tags.length > 0 && (
        <span className="sp-word__tags">{item.verdict.tags.slice(0, 2).join(' · ')}</span>
      )}
    </div>
  );
});
