import { useState } from 'react';

/** 随手就能投喂的样例，点一下填入输入框 */
const SAMPLES: readonly string[] = [
  '海上生明月',
  '天涯共此时',
  '亡羊补牢',
  '宁静致远',
  'serendipity',
  '山',
];

export interface ComposerProps {
  onSubmit: (text: string) => void | Promise<void>;
  disabled?: boolean;
  /** 语义模型正在思考这一口 */
  busy?: boolean;
}

export function Composer({
  onSubmit,
  disabled = false,
  busy = false,
}: ComposerProps): JSX.Element {
  const [draft, setDraft] = useState('');
  const [shake, setShake] = useState(0);

  const submit = (value: string): void => {
    const text = value.trim();
    if (!text) {
      setShake((current) => current + 1);
      return;
    }
    onSubmit(text);
    setDraft('');
  };

  return (
    <form
      className="sp-composer"
      key={shake}
      data-shake={shake > 0 ? 'yes' : 'no'}
      onSubmit={(event) => {
        event.preventDefault();
        submit(draft);
      }}
    >
      <div className="sp-composer__chips">
        {SAMPLES.map((sample) => (
          <button key={sample} type="button" onClick={() => setDraft(sample)}>
            {sample}
          </button>
        ))}
      </div>

      <div className="sp-composer__row">
        <input
          value={draft}
          disabled={disabled || busy}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="写一句有味道的话，回车投喂…"
          aria-label="投喂内容"
          maxLength={60}
        />
        <button type="submit" disabled={disabled || busy}>
          {busy ? '嗅探中…' : '投喂'}
        </button>
      </div>

      <p className="sp-composer__hint">
        蜘蛛用浏览器里的语义模型判断文字有没有味道：诗词、成语、像样的句子或单词。回车后文字落在场地随机处，它会爬过去尝一口。
      </p>
    </form>
  );
}
