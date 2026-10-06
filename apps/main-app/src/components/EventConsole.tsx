import type { GameEvent } from '@games/shared';

export interface EventConsoleProps {
  events: GameEvent[];
  onClear: () => void;
}

const PHASE_TEXT: Record<GameEvent['phase'], string> = {
  before: '前',
  after: '后',
  error: '错',
};

/** 事件控制台：直观证明「子应用的每个动作都触发了父组件的钩子」 */
export function EventConsole(props: EventConsoleProps): JSX.Element {
  const { events, onClear } = props;

  return (
    <section className="console">
      <header className="console__header">
        <h3>父应用钩子触发记录</h3>
        <span className="badge badge--brand">{events.length}</span>
        <button className="btn btn--ghost btn--sm" style={{ marginLeft: 'auto' }} onClick={onClear}>
          清空
        </button>
      </header>

      <ol className="console__list">
        {events.length === 0 && <li className="console__empty">暂无事件，打开一个游戏试试</li>}
        {events.map((event, index) => (
          <li
            key={`${event.timestamp}-${index}`}
            className={`console__item console__item--${event.phase}`}
          >
            <span className="console__phase">{PHASE_TEXT[event.phase]}</span>
            <span className="console__label">{event.label}</span>
            <code className="console__type">
              {event.type}/{event.phase}
            </code>
            {event.durationMs !== undefined && (
              <span className="console__ms">{event.durationMs}ms</span>
            )}
            {event.error && <span className="console__error">{event.error.message}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
