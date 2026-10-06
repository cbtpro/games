import type { GameCommand, Unsubscribe } from '@games/shared';

type Handler = (command: GameCommand) => void;

/** 父 -> 子 的命令通道。父应用下发，子应用订阅。 */
export class CommandHub {
  private handlers = new Set<Handler>();

  subscribe(handler: Handler): Unsubscribe {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  dispatch(command: GameCommand): void {
    for (const handler of Array.from(this.handlers)) {
      try {
        handler(command);
      } catch (error) {
        console.error('[CommandHub] 子应用处理命令失败', error);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
