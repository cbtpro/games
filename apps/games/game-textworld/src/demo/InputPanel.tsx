import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useSpeechInput } from './useSpeechInput';

/** 输入面板。桌面支持文本和语音，移动端提供语音开关与示例句。 */

export interface InputPanelProps {
  onSubmit: (text: string) => boolean | void;
  disabled?: boolean;
  count: number;
  mobile?: boolean;
  onVoiceStatus?: (status: string) => void;
}

const SAMPLES: readonly string[] = [
  '今天天气真的很好',
  '我们去海边走走吧',
  '风把窗帘吹得鼓起来',
  '这一刻值得被记住',
  '远处的灯塔亮了一下',
];

function MicIcon(): JSX.Element {
  return (
    <svg
      className="tw-mic__icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
      />
    </svg>
  );
}

export interface InputPanelHandle {
  startVoice: () => void;
}
export const InputPanel = forwardRef<InputPanelHandle, InputPanelProps>(function InputPanel(
  { onSubmit, disabled = false, count, mobile = false, onVoiceStatus },
  ref,
): JSX.Element {
  const [value, setValue] = useState('');

  const {
    supported,
    listening: voiceOn,
    interim,
    error,
    start: startVoice,
    stop: stopVoice,
    toggle: toggleVoice,
  } = useSpeechInput({
    lang: 'zh-CN',
    onFinal: (text) => {
      if (disabled) return;
      onSubmit(text);
    },
  });

  useEffect(() => {
    onVoiceStatus?.(
      error ||
        (!supported
          ? '语音不可用，请在操作面板使用示例或演示'
          : voiceOn
            ? interim || '聆听中…'
            : '语音已停止'),
    );
  }, [onVoiceStatus, error, supported, voiceOn, interim]);

  useImperativeHandle(ref, () => ({ startVoice }), [startVoice]);

  // 暂停或失活时停止语音输入。
  useEffect(() => {
    if (disabled && voiceOn) stopVoice();
  }, [disabled, voiceOn, stopVoice]);

  const submit = (): void => {
    const text = value.trim();
    if (text.length === 0) return;
    if (onSubmit(text) === false) return;
    setValue('');
  };

  return (
    <div className="tw-input">
      <div className="tw-input__row">
        {!mobile && (
          <>
            <input
              className="tw-input__field"
              value={value}
              disabled={disabled}
              placeholder={disabled ? '游戏未开始' : '说一句话，或点「语音」直接说…'}
              maxLength={80}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                submit();
              }}
              aria-label="输入一句话"
            />
          </>
        )}
        {supported && (
          <button
            className={`tw-mic ${voiceOn ? 'tw-mic--on' : ''}`}
            onClick={toggleVoice}
            disabled={disabled}
            aria-pressed={voiceOn}
            title={voiceOn ? '停止聆听' : '开始语音输入'}
          >
            <MicIcon />
            <span className="tw-mic__label">{voiceOn ? '停止' : '语音'}</span>
          </button>
        )}

        {!mobile && (
          <button
            className="tw-btn tw-btn--primary"
            onClick={submit}
            disabled={disabled || value.trim().length === 0}
          >
            追加
          </button>
        )}
      </div>

      {voiceOn && (
        <div className="tw-interim" aria-live="polite">
          <span className="tw-interim__dot" />
          {interim ? interim : '聆听中…'}
        </div>
      )}

      {!supported && (
        <p className="tw-voice-note">
          {mobile
            ? '当前浏览器不支持语音，请使用 Auto Demo 或点击示例句。'
            : '当前浏览器不支持语音输入，可用上方输入框手动添加。'}
        </p>
      )}
      {error && <p className="tw-voice-note tw-voice-note--err">{error}</p>}

      <div className="tw-input__meta">
        <span>已有 {count} 句</span>
        <div className="tw-input__samples">
          {SAMPLES.map((sample) => (
            <button
              key={sample}
              className="tw-chip"
              disabled={disabled}
              onClick={() => (mobile ? onSubmit(sample) : setValue(sample))}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
