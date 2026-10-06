import { useState } from 'react';
import type { GameLaunchConfig } from '@games/shared';

export interface LaunchFormValue {
  playerName: string;
  difficulty: NonNullable<GameLaunchConfig['difficulty']>;
  theme: NonNullable<GameLaunchConfig['theme']>;
  soundEnabled: boolean;
  params: Record<string, unknown>;
}

export interface LaunchFormProps {
  /** 子游戏启动参数表单。 */
  opened?: boolean;
  disabled?: boolean;
  onSubmit: (value: LaunchFormValue) => void;
}

const DEFAULT_PARAMS = '{\n  "seed": 2026\n}';

/** 打开子游戏时的参数表单 —— 这就是「父组件打开子项目时传入参数」的入口 */
export function LaunchForm(props: LaunchFormProps): JSX.Element {
  const { opened = false, disabled = false, onSubmit } = props;
  const [playerName, setPlayerName] = useState('玩家01');
  const [difficulty, setDifficulty] = useState<LaunchFormValue['difficulty']>('normal');
  const [theme, setTheme] = useState<LaunchFormValue['theme']>('light');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paramsText, setParamsText] = useState(DEFAULT_PARAMS);
  const [paramsError, setParamsError] = useState<string | null>(null);

  const submit = (): void => {
    let params: Record<string, unknown> = {};
    if (paramsText.trim()) {
      try {
        const parsed = JSON.parse(paramsText) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setParamsError('自定义参数必须是 JSON 对象');
          return;
        }
        params = parsed as Record<string, unknown>;
      } catch {
        setParamsError('自定义参数不是合法 JSON');
        return;
      }
    }
    setParamsError(null);
    onSubmit({ playerName: playerName.trim() || '游客', difficulty, theme, soundEnabled, params });
  };

  return (
    <form
      className="launch-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className="field">
        <span>玩家昵称</span>
        <input
          className="input"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="玩家01"
        />
      </label>

      <label className="field">
        <span>难度</span>
        <select
          className="select"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as LaunchFormValue['difficulty'])}
        >
          <option value="easy">简单</option>
          <option value="normal">普通</option>
          <option value="hard">困难</option>
        </select>
      </label>

      <label className="field">
        <span>主题</span>
        <select
          className="select"
          value={theme}
          onChange={(e) => setTheme(e.target.value as LaunchFormValue['theme'])}
        >
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>

      <label className="field launch-form__full">
        <span>自定义参数（JSON，原样传给子游戏）</span>
        <textarea
          className="textarea"
          rows={3}
          value={paramsText}
          onChange={(e) => setParamsText(e.target.value)}
        />
      </label>

      <label className="launch-form__check launch-form__full">
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(e) => setSoundEnabled(e.target.checked)}
        />
        <span>开启音效</span>
      </label>

      {paramsError && <p className="launch-form__error">{paramsError}</p>}

      <div className="launch-form__full">
        <button className="btn btn--primary" type="submit" disabled={disabled}>
          {opened ? '用新参数重新打开' : '打开游戏'}
        </button>
      </div>
    </form>
  );
}
