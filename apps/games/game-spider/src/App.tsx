import { modelOptionsFromEnv, useSemanticAnalyzer } from '@games/ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFullscreen, useGame } from '@games/sdk';
import { GAME_EVENTS } from '@games/shared';
import { createSpiderJudge } from './ai';
import type { SemanticProfile } from './ai';
import { Composer } from './components/Composer';
import { Spider } from './components/Spider';
import { TendrilLayer } from './components/TendrilLayer';
import { WordCard } from './components/WordCard';
import { judgeText, nextPalate, scoreOf } from './domain/palatability';
import type { WordItem } from './domain/types';
import { HP_MAX, isDraining, moodRank } from './domain/vitality';
import type { MoodKey } from './domain/vitality';
import { useSpiderEngine } from './hooks/useSpiderEngine';
import { useVitality } from './hooks/useVitality';
import { useWordField } from './hooks/useWordField';

/** 难度只影响两件事：爬得多快、嘴有多刁 */
const TUNING = {
  easy: { speed: 0.1, factor: 0.9 },
  normal: { speed: 0.13, factor: 1 },
  hard: { speed: 0.17, factor: 1.15 },
} as const;

type DifficultyKey = keyof typeof TUNING;

interface RunState {
  score: number;
  eaten: string[];
  delicacies: number;
  patience: number;
}

const INITIAL_RUN: RunState = { score: 0, eaten: [], delicacies: 0, patience: 3 };

interface LogEntry {
  id: number;
  tone: 'eat' | 'reject' | 'junk';
  title: string;
  detail: string;
}

/** 本局结局：喂饱了继续，喂不动就被吃掉 */
type Outcome = 'playing' | 'dead';

function isDifficultyKey(value: string | undefined): value is DifficultyKey {
  return !!value && Object.prototype.hasOwnProperty.call(TUNING, value);
}

/**
 * 玩法界面。
 *
 * 这里只做编排：文字投放交给 useWordField，爬行与抓取交给 useSpiderEngine，
 * 口味鉴定交给 domain 层。组件不认识 rAF，也不认识 qiankun。
 */
export default function App(): JSX.Element {
  const ctx = useGame();
  const { config } = ctx;

  const tuning = isDifficultyKey(config.difficulty) ? TUNING[config.difficulty] : TUNING.normal;

  const fieldRef = useRef<HTMLDivElement>(null);
  const field = useWordField(fieldRef);

  const rootRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(rootRef);

  // 浏览器内的语义模型：挂载即后台加载，没好之前用应急规则顶上。
  // 模型与向量运算来自公共包 @games/ai，这里只喂蜘蛛自己的语义轴。
  const { status: aiStatus, analyze, retry: retryAi } = useSemanticAnalyzer<SemanticProfile>(
    (report) =>
      createSpiderJudge({
        model: { ...modelOptionsFromEnv(import.meta.env), onProgress: report },
      }),
    [],
  );

  const [run, setRun] = useState<RunState>(INITIAL_RUN);
  const [running, setRunning] = useState(false);
  const [active, setActive] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [toast, setToast] = useState<LogEntry | null>(null);
  const [sniffing, setSniffing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>('playing');
  const seq = useRef(0);
  const startedRef = useRef(false);

  // 引擎在动画帧里读取最新值，用 ref 镜像 state，避免闭包拿到旧值
  const runRef = useRef(run);
  runRef.current = run;

  const palate = useMemo(() => nextPalate(run.delicacies, tuning.factor), [run.delicacies, tuning.factor]);
  const palateRef = useRef(palate);
  palateRef.current = palate;

  const pushLog = useCallback((entry: Omit<LogEntry, 'id'>): void => {
    seq.current += 1;
    const next: LogEntry = { ...entry, id: seq.current };
    setToast(next);
    setLog((current) => [next, ...current].slice(0, 8));
  }, []);

  // ------------------------------------------------------------ 生命体征

  /**
   * 冷落蜘蛛是要付代价的：饥饿持续上涨 -> 情绪逐级恶化 -> 生命值开始流失。
   * 数值全在 domain/vitality.ts，这里只负责把它接进游戏循环。
   */
  const vitality = useVitality({
    running,
    active,
    factor: tuning.factor,
    onDepleted: () => {
      setOutcome('dead');
      void ctx.die({ reason: 'starved', hp: 0 });
    },
  });

  const moodRef = useRef<MoodKey>(vitality.mood.key);
  useEffect(() => {
    const mood = vitality.mood;
    const worsened = moodRank(mood.key) > moodRank(moodRef.current);
    moodRef.current = mood.key;
    if (!worsened || !isDraining(mood)) return;
    pushLog({
      tone: 'reject',
      title: `蜘蛛${mood.label}了`,
      detail: `${mood.hint} · 生命值 -${mood.drainPerSec}/秒`,
    });
  }, [pushLog, vitality.mood]);

  // ------------------------------------------------------------ 进食 / 拒食

  const handleEat = useCallback(
    (item: WordItem): void => {
      const gained = scoreOf(item.verdict, palateRef.current);
      const total = runRef.current.score + gained;
      const isDelicacy = item.verdict.grade === 'delicacy';

      field.remove(item.id);
      vitality.feed(item.verdict.grade);
      setRun((current) => ({
        ...current,
        score: current.score + gained,
        eaten: [...current.eaten, item.text],
        delicacies: current.delicacies + (isDelicacy ? 1 : 0),
      }));
      ctx.store.set('score', total);
      ctx.reportScore({ score: total, mode: 'total' });
      pushLog({ tone: 'eat', title: item.text, detail: `${item.verdict.reason} · +${gained}` });
    },
    [ctx, field, pushLog, vitality],
  );

  const handleReject = useCallback(
    (item: WordItem): void => {
      field.remove(item.id);
      // 爬过去闻了又吐掉：没吃到东西，反而更饿
      vitality.spurn();
      const left = runRef.current.patience - 1;
      setRun((current) => ({ ...current, patience: Math.max(0, current.patience - 1) }));
      pushLog({ tone: 'reject', title: item.text, detail: `${item.verdict.reason} · 耐心 -1` });
      if (left <= 0) void ctx.die({ reason: 'no-patience' });
    },
    [ctx, field, pushLog, vitality],
  );

  const engine = useSpiderEngine({
    fieldRef,
    wordRefs: field.wordRefs,
    itemsRef: field.itemsRef,
    running,
    active,
    // 越烦躁窜得越快：追得上，但也更吓人
    speed: tuning.speed * vitality.mood.speedFactor,
    onEat: handleEat,
    onReject: handleReject,
  });

  // ------------------------------------------------------------ 投喂

  const submit = useCallback(
    async (text: string): Promise<void> => {
      setSniffing(true);
      try {
        // 语义画像由模型算（未就绪时自动用应急规则），判定本身是纯函数
        const profile = await analyze(text, runRef.current.eaten);
        const verdict = judgeText({ text, palate: palateRef.current, profile });

        if (verdict.grade === 'junk') {
          pushLog({ tone: 'junk', title: text, detail: verdict.reason });
          return;
        }

        const placed = field.add(text, verdict);
        if (!placed) {
          pushLog({ tone: 'junk', title: text, detail: '地上太挤了，先让它把眼前的吃完' });
        }
      } finally {
        setSniffing(false);
      }
    },
    [analyze, field, pushLog],
  );

  // ------------------------------------------------------------ 生命周期

  const resetAll = useCallback((): void => {
    field.clear();
    setRun(INITIAL_RUN);
    setLog([]);
    setToast(null);
    setOutcome('playing');
    vitality.reset();
    engine.reset();
  }, [engine, field, vitality]);

  useEffect(
    () =>
      ctx.bus.on((event) => {
        if (event.phase !== 'after') return;
        switch (event.type) {
          case GAME_EVENTS.START:
          case GAME_EVENTS.RESUME:
            setRunning(true);
            break;
          case GAME_EVENTS.PAUSE:
            setRunning(false);
            break;
          case GAME_EVENTS.ACTIVATE:
            setActive(true);
            break;
          case GAME_EVENTS.DEACTIVATE:
            setActive(false);
            break;
          case GAME_EVENTS.RESTART:
            startedRef.current = false;
            resetAll();
            setRunning(true);
            break;
          case GAME_EVENTS.DEATH:
            // 不管是饿死的还是耐心耗尽的，都进结算画面
            setOutcome('dead');
            setRunning(false);
            break;
          case GAME_EVENTS.END:
            setOutcome('dead');
            setRunning(false);
            break;
          default:
            break;
        }
      }),
    [ctx, resetAll],
  );

  /**
   * 开工。
   *
   * 不能只靠 ACTIVATE 事件判断：宿主的 mount/activate 可能在 React 的
   * useEffect 订阅之前就发出过了（qiankun 的挂载与 React 渲染是两条时间线），
   * 事件会被漏掉。这里改成挂载后无条件补一次 start ——
   * 独立调试同样适用，且重复的 start 只是重放一次钩子，没有副作用。
   */
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void ctx.start();
  }, [ctx]);

  const latestDislike = palate.dislikes[palate.dislikes.length - 1] ?? '眼下还算好说话';

  const aiLabel =
    aiStatus.phase === 'ready'
      ? 'AI 味觉已就绪 —— 浏览器内语义模型实时判定'
      : aiStatus.phase === 'loading'
        ? `正在下载语义模型 ${Math.round(aiStatus.progress * 100)}%（期间先用应急规则）`
        : aiStatus.phase === 'failed'
          ? '语义模型不可用，已切换应急规则'
          : '正在唤醒 AI 味觉…';

  return (
    <div
      className="sp-app"
      ref={rootRef}
      data-fullscreen={fullscreen.isFullscreen || undefined}
    >
      <header className="sp-hud">
        <div className="sp-hud__meta">
          <h2>喂蜘蛛</h2>
          <span className="sp-badge">Lv{palate.level} 挑食</span>
          <span className="sp-mood" data-mood={vitality.mood.key}>
            <span className="sp-mood__dot" aria-hidden />
            {vitality.mood.label}
          </span>
          <p>
            入口门槛 {palate.minScore} 分 · {latestDislike}
          </p>
        </div>

        <div className="sp-vitals" data-mood={vitality.mood.key}>
          <div className="sp-vital">
            <span className="sp-vital__label">生命</span>
            <span className="sp-bar sp-bar--hp">
              <i style={{ width: `${(vitality.state.hp / HP_MAX) * 100}%` }} />
            </span>
            <span className="sp-vital__value">{Math.ceil(vitality.state.hp)}</span>
          </div>
          <div className="sp-vital">
            <span className="sp-vital__label">饥饿</span>
            <span className="sp-bar sp-bar--hunger">
              <i style={{ width: `${vitality.state.hunger}%` }} />
            </span>
            <span className="sp-vital__value">{Math.round(vitality.state.hunger)}</span>
          </div>
          <p className="sp-vitals__hint">
            {isDraining(vitality.mood)
              ? `${vitality.mood.hint} · 已 ${Math.floor(vitality.state.sinceFood)} 秒没吃到东西`
              : vitality.mood.hint}
          </p>
        </div>

        <div className="sp-hud__right">
          <div className="sp-hud__stats">
            <div className="sp-stat sp-stat--score">
              <span>分数</span>
              <strong>{run.score}</strong>
            </div>
            <div className="sp-stat">
              <span>佳肴</span>
              <strong>{run.delicacies}</strong>
            </div>
            <div className="sp-stat">
              <span>耐心</span>
              <strong className="sp-hearts">{'●'.repeat(run.patience) || '—'}</strong>
            </div>
          </div>

          {fullscreen.isSupported && (
            <button
              className="sp-fs"
              onClick={() => void fullscreen.toggle()}
              aria-pressed={fullscreen.isFullscreen}
              title={fullscreen.isFullscreen ? '退出全屏（Esc）' : '全屏投喂'}
            >
              <svg viewBox="0 0 16 16" aria-hidden focusable="false">
                {fullscreen.isFullscreen ? (
                  <path
                    d="M6.5 2.5v3h-3M9.5 2.5v3h3M6.5 13.5v-3h-3M9.5 13.5v-3h3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d="M2.5 6v-3.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
              {fullscreen.isFullscreen ? '退出全屏' : '全屏'}
            </button>
          )}
        </div>
      </header>

      <div className="sp-main">
        <div className="sp-field" ref={fieldRef} data-mood={vitality.mood.key}>
          {field.items.map((item) => (
            <WordCard key={item.id} item={item} register={field.register} />
          ))}

          <TendrilLayer subscribe={engine.subscribe} />
          <div className="sp-grasp-layer" />
          <Spider subscribe={engine.subscribe} mood={vitality.mood} />

          {isDraining(vitality.mood) && running && (
            <div className="sp-field__mood" data-mood={vitality.mood.key}>
              <b>{vitality.mood.label}</b>
              <span>
                {vitality.mood.hint} · 生命 -{vitality.mood.drainPerSec}/秒
              </span>
            </div>
          )}

          {outcome === 'dead' && (
            <div className="sp-over">
              <div className="sp-over__inner">
                <h3>你被当成点心了</h3>
                <p>
                  蜘蛛饿到失控，本局 {run.score} 分 · 吃到 {run.eaten.length} 口 · 佳肴{' '}
                  {run.delicacies} 道
                </p>
                <p className="sp-over__tip">
                  活得久的诀窍不是一次喂饱，而是别让它闲下来 —— 每十几秒递一句像样的话。
                </p>
                <button type="button" className="sp-over__btn" onClick={() => void ctx.restart()}>
                  再来一局
                </button>
              </div>
            </div>
          )}

          {!running && outcome === 'playing' && (
            <div className="sp-field__idle">
              按「开始」把 <b>{config.playerName ?? '蜘蛛'}</b> 放出来觅食
            </div>
          )}

          {toast && (
            <div key={toast.id} className={`sp-toast sp-toast--${toast.tone}`}>
              <b>{toast.title}</b>
              <span>{toast.detail}</span>
            </div>
          )}
        </div>

        <aside className="sp-side">
          <header className="sp-side__head">
            <h3>战报</h3>
            <span>{log.length}</span>
          </header>
          {log.length === 0 ? (
            <p className="sp-side__empty">还没有投喂记录</p>
          ) : (
            <ol className="sp-side__list">
              {log.map((entry) => (
                <li key={entry.id} className={`sp-side__item sp-side__item--${entry.tone}`}>
                  <span className="sp-side__title">{entry.title}</span>
                  <span className="sp-side__detail">{entry.detail}</span>
                </li>
              ))}
            </ol>
          )}

          <header className="sp-side__head">
            <h3>忌口</h3>
          </header>
          <ul className="sp-side__dislikes">
            {palate.dislikes.length === 0 ? (
              <li>来者不拒</li>
            ) : (
              palate.dislikes.map((item) => <li key={item}>{item}</li>)
            )}
          </ul>
        </aside>
      </div>

      <div className="sp-ai" data-phase={aiStatus.phase}>
        <span className="sp-ai__dot" aria-hidden />
        <span className="sp-ai__text">{aiLabel}</span>
        {aiStatus.phase === 'loading' && (
          <span className="sp-ai__bar">
            <i style={{ width: `${Math.round(aiStatus.progress * 100)}%` }} />
          </span>
        )}
        {aiStatus.phase === 'failed' && (
          <button type="button" className="sp-ai__retry" onClick={retryAi}>
            重试
          </button>
        )}
      </div>

      <Composer onSubmit={submit} disabled={!running} busy={sniffing} />
    </div>
  );
}
