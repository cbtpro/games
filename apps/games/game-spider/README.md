# spider（game-spider）

由 `pnpm new:game` 从空白模板生成。

- 独立调试：`pnpm --filter game-spider dev` → http://127.0.0.1:7102
- 生产预览：`pnpm --filter game-spider preview` → http://127.0.0.1:7202
- 被主应用加载：先启动本子应用（dev）或 preview（prod），再从主应用打开

开发入口：

- `src/game.tsx` —— 生命周期钩子（onStart / onPause / onDeath / onRestart / onEnd …）
- `src/App.tsx` —— React 玩法界面，用 `useGame()` 拿上下文
