import type { GameHandle } from '../host';

export interface GameControlBarProps {
  handle: GameHandle | null;
  state: string;
  onClose: () => void;
}

/**
 * 父应用控制条。
 * 每个按钮都是一条「父 -> 子」命令，最终落到子游戏的生命周期钩子上。
 */
export function GameControlBar(props: GameControlBarProps): JSX.Element {
  const { handle, state, onClose } = props;
  const disabled = !handle;

  const act = (fn: () => void) => () => {
    if (!handle) return;
    fn();
  };

  return (
    <div className="control-bar">
      <span className="control-bar__state">
        子应用状态
        <span className="state-badge">{state || '未加载'}</span>
      </span>

      <div className="control-bar__group">
        <button className="btn btn--sm" disabled={disabled} onClick={act(() => handle?.start())}>
          开始
        </button>
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() => handle?.pause('parent'))}
        >
          暂停
        </button>
        <button className="btn btn--sm" disabled={disabled} onClick={act(() => handle?.resume())}>
          继续
        </button>
        <button className="btn btn--sm" disabled={disabled} onClick={act(() => handle?.restart())}>
          重开
        </button>
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() => handle?.stop({ score: 0, reason: 'host-stop' }))}
        >
          结束
        </button>
      </div>

      <div className="control-bar__group">
        <button className="btn btn--sm" disabled={disabled} onClick={act(() => handle?.activate())}>
          激活
        </button>
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() => handle?.deactivate())}
        >
          去激活
        </button>
      </div>

      <div className="control-bar__group">
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() => handle?.updateConfig({ difficulty: 'easy' }))}
        >
          改参·简单
        </button>
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() => handle?.updateConfig({ difficulty: 'hard' }))}
        >
          改参·困难
        </button>
        <button
          className="btn btn--sm"
          disabled={disabled}
          onClick={act(() =>
            handle?.send({ type: 'game:custom:hello', payload: { from: 'host' } }),
          )}
        >
          自定义命令
        </button>
      </div>

      <button
        className="btn btn--sm btn--danger control-bar__danger"
        disabled={disabled}
        onClick={onClose}
      >
        关闭并销毁
      </button>
    </div>
  );
}
