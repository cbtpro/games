import { useCallback, useEffect, useRef, useState } from 'react';

/** 通过 Web Speech API 接收语音，回显识别中的文本，并将完整句子交给 onFinal。 */

/** 结构类型：SpeechRecognition 并非所有 TS lib 都带全量声明，这里只描述我们用到的成员 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    mozSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? w.mozSpeechRecognition ?? null;
}

function mapError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝，请在浏览器设置里允许后重试';
    case 'audio-capture':
      return '没有检测到麦克风设备';
    case 'network':
      return '网络异常，语音识别暂时不可用';
    default:
      return '语音识别出错，请重试';
  }
}

export interface UseSpeechInputOptions {
  lang?: string;
  /** 识别到一句完整的话时回调（已 trim，空串会被过滤） */
  onFinal: (text: string) => void;
}

export interface UseSpeechInputResult {
  supported: boolean;
  listening: boolean;
  /** 还在「听」但没说完的临时文本，用于实时回显 */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

export function useSpeechInput({
  lang = 'zh-CN',
  onFinal,
}: UseSpeechInputOptions): UseSpeechInputResult {
  const [supported] = useState<boolean>(() => getCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);

  const stop = useCallback(() => {
    listeningRef.current = false;
    setListening(false);
    setInterim('');
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.onend = null;
        rec.stop();
      } catch {
        /* 已停止则忽略 */
      }
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || listeningRef.current) return;

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true; // 一句话说完继续听，自动拆分多句
    rec.interimResults = true; // 实时回显
    rec.maxAlternatives = 1;

    // 防止异常时无限重启
    let restarts = 0;

    rec.onstart = () => {
      setError(null);
    };

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let interimText = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText) {
        setInterim('');
        const text = finalText.trim();
        if (text) onFinalRef.current(text);
      } else if (interimText) {
        setInterim(interimText);
      }
    };

    rec.onerror = (event: SpeechRecognitionErrorLike) => {
      const code = event.error;
      // no-speech / aborted 属于正常流程，交给 onend 处理
      if (code === 'no-speech' || code === 'aborted') return;
      if (code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
        stop();
      }
      setError(mapError(code));
    };

    rec.onend = () => {
      // continuous 模式在静音后会自动结束，用户仍想听就自动续上
      if (listeningRef.current && restarts < 50) {
        restarts++;
        try {
          rec.start();
          return;
        } catch {
          /* 立刻重试失败则等下一次 end 再续 */
        }
      }
    };

    recognitionRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    try {
      rec.start();
    } catch {
      /* 连续 start 偶发抛错，onend 会补一次 */
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listeningRef.current) stop();
    else start();
  }, [start, stop]);

  // 卸载时彻底停掉，避免麦克风一直亮着
  useEffect(
    () => () => {
      listeningRef.current = false;
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.onend = null;
          rec.stop();
        } catch {
          /* 忽略 */
        }
      }
    },
    [],
  );

  return { supported, listening, interim, error, start, stop, toggle };
}
