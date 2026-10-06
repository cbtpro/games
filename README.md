# 微前端互联网游戏平台

pnpm workspace + NestJS/TypeORM/MySQL + React + qiankun 的前后端分离游戏平台。
**每个游戏是一个独立的子项目**，主应用负责装载、传参、下发命令与收集生命周期事件。

```
games/
├── packages/
│   ├── shared/   # 父子之间的「法律」：生命周期契约 / 事件 / 命令 / 状态机 / API DTO
│   ├── sdk/      # 子游戏 SDK：生命周期编排器 + 父子通信桥 + React 集成
│   └── ai/       # 浏览器内 AI 能力：语义模型加载 / 向量 / 语义坐标，所有子游戏共用
├── apps/
│   ├── server/        # NestJS + TypeORM + MySQL 后端（:3000）
│   ├── main-app/      # 主应用（qiankun 父应用，:7100）
│   └── games/
│       ├── game-template/    # 空白子游戏模板（dev :7101 / preview :7201）
│       ├── game-spider/      # 「喂蜘蛛」：浏览器内语义模型判定文字（dev :7102）
│       └── game-textworld/   # 「文字世界」：实时语音驱动的动态文字世界（dev :7103）
└── scripts/
    ├── init-db.sh      # 初始化 MySQL 库与用户
    ├── create-game.mjs # 从模板复制出新游戏
    ├── fetch-semantic-model.mjs  # 下载语义模型到本地（可选，离线/加速用）
    └── db/00-init-database.sql
```

## 快速开始

```bash
# 1. 数据库（用 root/root 创建 games 库、games/games 用户）
pnpm db:init

# 2. 安装依赖
pnpm install

# 3. 全量启动（后端 + 主应用 + 所有子游戏）
pnpm dev
```

打开 http://127.0.0.1:7100 ，首页是**游戏库**；点卡片进入 `/play/<code>` 才装载子游戏。

| 服务                 | 地址                                            |
| -------------------- | ----------------------------------------------- |
| 主应用（游戏库 `/`） | http://127.0.0.1:7100                           |
| 主应用（游戏页）     | http://127.0.0.1:7100/play/:gameCode            |
| 404 兜底页           | http://127.0.0.1:7100/404（未匹配路由自动跳转） |
| 后端 API             | http://127.0.0.1:3000/api                       |
| Swagger              | http://127.0.0.1:3000/docs                      |
| 子游戏（独立调试）   | http://127.0.0.1:7101                           |

## 页面与路由（主应用）

```
/                游戏库：hero + 游戏卡片网格，点击卡片 → /play/:code
/play/:gameCode  游戏页：启动参数 → 装载子应用 → 控制条 + 事件控制台
/404             兜底页；未知路由重定向到这里，未知 gameCode 也会渲染它
```

路由用 `react-router-dom`；游戏目录数据由 `useGames()` 统一提供（单一数据源）。

## 界面设计系统

主应用与游戏模板共用同一套设计语言（令牌定义在 `apps/main-app/src/styles/tokens.css`）：

- **色彩**：靛蓝 `--brand-*` + 珊瑚 `--accent-*` + 三级中性灰，全站 ≤16 色；
  所有关键前景/背景组合通过 WCAG AA（≥4.5:1）校验；
- **间距**：4/8pt 网格；**圆角**：组件 12px / 卡片 16px / 胶囊 999px；
- **阴影**：统一两层克制阴影（`--shadow-sm/md/lg`），禁用单层重阴影；
- **字体**：Space Grotesk（展示/数字）+ Inter + PingFang SC（正文），
  数字一律 `tabular-nums`；
- **动效**：`--ease-spring` 弹性曲线，160–240ms，仅 transform/opacity；
  尊重 `prefers-reduced-motion`；
- **可访问性**：可点元素 ≥44px 高，`:focus-visible` 有全局焦点环。

子游戏模板自带同名语义的 `--tg-*` 局部令牌并支持 `data-theme` 深浅切换，
不依赖宿主全局样式，独立运行时观感一致。

## 生命周期设计

### 子游戏要实现的钩子（`packages/sdk`）

钩子均为可选配置。事件由 SDK 统一派发，父应用仍可接收未配置子应用钩子的事件。

| 钩子                               | 触发时机                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| `onInit`                           | qiankun `bootstrap`：拿到父应用参数，预加载资源（无 DOM） |
| `onMount`                          | qiankun `mount`：React 树已渲染，可操作 DOM               |
| `onUnmount`                        | qiankun `unmount`：释放定时器/监听/上下文                 |
| `onActivate` / `onDeactivate`      | 回到前台 / 退到后台，状态保留                             |
| `onStart` / `onPause` / `onResume` | 开始 / 暂停 / 继续                                        |
| `onDeath`                          | 死亡（还有命，可重开）                                    |
| `onRestart`                        | 重开                                                      |
| `onEnd`                            | 结算，产出 `GameResult`                                   |
| `onConfigUpdate`                   | 父应用改了启动参数                                        |
| `onError` / `onCommand`            | 异常兜底 / 自定义命令                                     |

### 每个钩子都会向父应用派发三段事件

```ts
{ type: 'game:start', phase: 'before' | 'after' | 'error', durationMs, payload, state }
```

父应用用 `GameHostHooks` 接收，钩子以**集合**为单位注册，按需插拔：

```ts
gameHost.registerHooks(createSessionSyncHooks({ gameCode, sessionId })); // 会话 + 计分
gameHost.registerHooks(createTelemetryHooks(telemetry)); // 埋点上报
gameHost.registerHooks(myCustomHooks); // 你的业务
```

已内置：`createLoggingHooks`（控制台）、`createTelemetryHooks`（批量上报后端）、
`createSessionSyncHooks`（生命周期 → 会话状态 + 分数落库）、`createEventLogHooks`（右侧事件控制台）。

### 父 → 子：传参与命令

```ts
// 打开时注入参数
await gameHost.launch({ game, container, config: { playerName, difficulty, params } });

// 运行中下发命令
handle.start();
handle.pause('parent');
handle.restart();
handle.updateConfig({ difficulty: 'hard' });
handle.send({ type: 'game:custom:hello', payload: { from: 'host' } });
handle.destroy();
```

### 子 → 父：主动上报

```ts
ctx.reportScore({ score: 100 });
ctx.emit('game:custom:level-up', { level: 3 });
ctx.sendCommand({ type: 'game:custom:need-help' });
```

## 新建一个游戏

```bash
pnpm new:game snake
```

脚本会复制模板、改名、自动分配端口（7102/7202 …），并提示把条目加到
`apps/server/src/seed/seed.service.ts` 的 `GAME_SEEDS`。然后：

```bash
pnpm install && pnpm dev
```

> 子应用的 `MICRO_APP_NAME` **必须**与平台注册的 `game.code` 一致。

### 子游戏入口约定（一行搞定）

新游戏的 `main.tsx` 只需要：

```ts
import { bootstrapMicroApp } from '@games/sdk';
import game from './game';
import './styles.css';

bootstrapMicroApp(game, {
  standaloneContainer: '#game-root', // 独立运行时的挂载点
  standaloneConfig: {/* 独立调试默认参数 */},
});
```

SDK 内部会完成：注册 qiankun 生命周期（被托管时由宿主驱动）、
判断当前是否在宿主内、独立运行时用 StandaloneHostBridge 自行挂载。

**宿主识别原理**：Vite 子应用是动态 import 的 ES 模块，运行在真实 window 上，
qiankun 沙箱里的 `__POWERED_BY_QIANKUN__` 对它时序不稳定。因此主应用启动时
会在真实 window 上写入 `__GAMES_PLATFORM__` 标记（见 `main-app/src/host/hostPresence.ts`，
常量定义在 `shared/lifecycle/env.ts`），子应用只认这个确定性标记。

## 蜘蛛游戏的语义判定

判定文字有没有味道，用的是 **Transformers.js（`@huggingface/transformers`）**
在浏览器里直接推理 `Xenova/multilingual-e5-small`（int8 量化，约 110MB），
全程没有后端参与，也没有任何固定词表匹配。

```
src/ai/         游戏侧：只定义「蜘蛛的味觉」，通用能力来自 @games/ai
  types.ts          SemanticProfile / TextJudge 接口
  anchors.ts        「味觉坐标」：佳肴方向与敷衍方向的语义锚点
  semanticTaste.ts  语义轴定义 + 读数 → 画像的适配
  heuristicJudge.ts 降级规则（模型不可用时使用相同的输出结构）
  index.ts          createSpiderJudge：AI 优先，失败自动降级
src/domain/
  palatability.ts   纯函数：语义画像 + 形态 + 挑食等级 → 判定
  textShape.ts      字面形态统计（长度/用字多样性/句读/对仗/乱敲）
  vitality.ts       饥饿/情绪/生命值：挂机不喂必死的时间模型
```

**冷落蜘蛛的代价**：饥饿每秒上涨，情绪从「满足 → 饿了 → 烦躁 → 发怒 → 暴走」
逐级恶化；「烦躁」起玩家生命值开始按档位流失（1 → 2 → 3.2 点/秒），
归零即触发 `die({ reason: 'starved' })` 并进入结算层。吃到真东西会压饥饿、
回少量血；爬过去又吐掉反而更饿。情绪同时驱动蜘蛛体色、头顶符号、
焦躁抖动与爬行速度（最高 2 倍），暂停/切后台时时间冻结，重开即满血。
数值集中在 `domain/vitality.ts`，纯函数可单独推演调参。

语义判定的实现要点：

1. **句向量不能直接用余弦比**。e5 的句向量有强各向异性，任意两句相似度都在
   0.81~0.99，佳肴与敷衍只差 0.03，绝对阈值毫无区分力。
   做法是先减去锚点均值方向（公共语义成分）再归一化，差值立刻拉开到
   -0.5~+0.3，分层清晰。
2. **锚点是语义坐标，不是匹配词表**。锚点由「什么算好文字」的自然语言描述 +
   一批例句组成，输入只要落在那个语义区域附近就算好。实测中，
   **完全没出现在锚点里的名句依然能拿高分**（0.24~0.33），大白话则拿不到。
3. **语义级去重**：与已吃内容比向量，所以换个语序再喂同一句诗也会被识破
   （"这道菜上过了，换个新的"），可识别部分语义重复。
4. **降级不影响可玩性**：模型下载中/失败时用应急规则判定，UI 明确标注当前
   用的是哪种味觉，模型就绪后自动接管。

**模型来源**：默认从 Hugging Face 拉取（浏览器缓存，只下一次）。想离线或加速：

```bash
node scripts/fetch-semantic-model.mjs            # 下载到子应用 public/models/
node scripts/fetch-semantic-model.mjs --mirror   # 走 hf-mirror.com（国内更快）
VITE_HF_LOCAL=true pnpm --filter game-spider dev # 优先用本地模型
```

也支持 `VITE_HF_HOST=https://hf-mirror.com/` 只换下载源。
模型目录已被 `.gitignore` 排除，不入库。

## `@games/ai`：所有子游戏共用的浏览器内 AI

喂蜘蛛的语义判定已经抽成公共包，别的游戏想用「让模型理解一句话」直接装即可，
不需要再碰 transformers、向量缓存、各向异性修正这些细节。

```
packages/ai/src/
├── model/      句子 → 向量（懒加载、实例共享与引用计数、向量缓存）
├── semantic/   语义坐标系（多组锚点建系、语义轴评分）、降级组合器
└── react/      useSemanticAnalyzer / useSemanticReading
```

接入示例：定义语义轴，并配置资源地址。

```tsx
const { status, analyze } = useSemanticReading({
  axes: [{ key: 'epic', positive: ['大漠孤烟直，长河落日圆'], negative: ['今天天气不错'] }],
});
const reading = await analyze('落霞与孤鹜齐飞'); // reading.axes.epic: 0~1
```

新游戏接入只需两步：`package.json` 加 `@games/ai`，`vite.config.ts` 里
`define: assetOriginDefine(...)` + `...semanticModelConfig`。
需要配置资源来源地址： 被 qiankun 托管后 `import.meta.url` 会退化成 blob: URL，
运行时推不出自己的资源地址，模型会请求到宿主域名上。完整说明见 `packages/ai/README.md`。

## 「文字世界」：实时语音驱动的动态文字世界

`apps/games/game-textworld`（dev :7103）。第一阶段**不接语音**，用输入框 + Enter
模拟「识别出一句话」，验证核心玩法：

```
输入 → layoutEngine.append(text)
     → 文字测量 → 90° 旋转判断 → 布局 → 碰撞检测 → 出场动画 → Canvas 渲染 → 相机跟随
```

核心引擎是**纯 TypeScript**：不碰 Canvas、DOM、React，因此能在 Node 里直接跑
布局与碰撞的测试；渲染层可整体替换（Canvas → WebGL/Pixi 时核心零改动）。

```
src/
├── core/        纯 TS：LayoutEngine / CollisionEngine / RotationEngine /
│                AnimationEngine / TextMeasure / Camera / CameraController / TextWorld
├── renderer/    Renderer 接口 + CanvasRenderer（唯一的 Canvas 依赖）
├── animation/   出场预设、缓动、加权随机
└── demo/        InputPanel（语音的临时替身）+ CanvasView（唯一的 rAF）
```

实测：连说 8 句后世界长到 528×616、朝向自动转过 `向下 → 向右 → 向上 180°`，
相机自动缩到 36% 装下整片世界；父应用暂停会冻结动画，重开即刻清空。
接真实 ASR 时只需把 `InputPanel` 换成语音流，下游一行不用改。

### 相机旋转

文字块自带 0/90/180/270 的朝向（螺旋生长的前提），可照着块的朝向画，
转到 180° 时新句子就倒过来了。做法是**旋转整块画布**而不是旋转块：
相机反向旋转到最新文字的朝向，使最新文字保持水平，已有文字随画布一起旋转。

| 操作         | 行为                                            |
| ------------ | ----------------------------------------------- |
| 自动（默认） | 每次追加后画布补间到 `-最新句朝向`，约 1 秒到位 |
| ⟲ / ⟳        | 手动转 90°，**并自动退出跟随**，保留手动角度    |
| 转正         | 将最新文字转为水平                              |
| 跟随         | 重新把控制权交回自动摆正                        |

实现要点：

- 变换顺序为 `scale`、`rotate`、`translate`，以相机中心作为旋转中心
- `worldToScreen` / `screenToWorld` / `panBy` 全部按旋转矩阵换算，保证旋转后的拖动方向正确
- `visibleRect` / `fitZoom` 用**旋转后的外接矩形**，否则斜着的世界会顶出视口
- 角度补间走最短路径（`shortestAngleDelta`）并在小于阈值时吸附，
  否则指数缓动永远差最后一丝，角标读数会一直偏 1°

## 设计取舍

- **开闭原则**：新增游戏只写 `game.tsx` + `App.tsx`；新增父应用能力只 `registerHooks` 一套；
  新增事件只改 `EVENT_TO_HOST_HOOK` 映射表。平台代码零改动。
- **分离关注点**：`shared` 只放契约，SDK 只做编排，主应用只做装载与编排策略，
  子游戏只写玩法。子应用不直接依赖 qiankun（只依赖 `GameHostApi` 接口），可独立运行与单测。
- **高鲁棒性**
  - 生命周期调用走**串行队列**，并发命令不会竞态，单个失败不会污染队列；
  - 钩子异常 → 转成 `game:error` 事件上报，不中断其它钩子，不拖垮主应用；
  - 状态机只**观测不阻断**：非法迁移上报而非抛错；
  - 后端不可用 / 埋点失败 / 上报失败一律降级静默，游戏体验不受影响；
  - 所有清理逻辑集中在 `onUnmount`，主应用侧 `destroy()` 统一摘钩子、清沙箱。

## 常用命令

```bash
pnpm dev            # 全量开发（先构建 packages，再并行起所有服务）
pnpm build          # 构建 packages + 主应用 + 所有子游戏
pnpm typecheck      # 全量类型检查
pnpm db:init        # 重建数据库与用户（幂等）
pnpm new:game <code>
```

生产模式（主应用加载构建产物）：

```bash
pnpm build
pnpm --filter @games/server start:prod   # :3000
pnpm --filter game-template preview      # :7201
pnpm --filter @games/main-app preview    # :7100，此时走 entryProd
```

## 环境变量

`apps/server/.env`（已默认配好 `games/games`）：

```
DB_HOST=127.0.0.1  DB_PORT=3306
DB_USERNAME=games  DB_PASSWORD=games  DB_DATABASE=games
DB_SYNC=true   # 开发环境自动建表；生产请关闭并改用 migrations
PORT=3000      API_PREFIX=api
```

## 局域网访问

父应用及所有子应用的开发/预览服务默认监听 `0.0.0.0`。同一局域网设备使用开发机器 IP 访问父应用（7100）或子应用（7101、7102、7103）。注册表中的 localhost/127.0.0.1 子应用入口会按访问父应用的主机地址解析，保留原端口和路径。

开发子应用的资源来源默认选用本机外部 IPv4；多网卡环境可在启动时设置 `VITE_PUBLIC_HOST=你的局域网IP`，更换网络后重启服务。父应用通过 `/api` 和 `/health` 代理后端，后端地址仍可通过 `VITE_SERVER_TARGET` 配置。

开发与预览已默认启用 HTTPS，证书信任方式见下文。

## 本地 HTTPS 与语音

父应用、所有子应用的 `dev` 和 `preview` 默认启用 HTTPS。启动配置会调用 `scripts/dev-https.mjs`，检查根目录 `certs/server.pem` 和 `certs/server-key.pem`；缺失时使用 OpenSSL 生成本地根 CA 和服务器证书，包含 localhost、回环地址、当前网卡 IP 及 `VITE_PUBLIC_HOST`。仅构建项目不会生成证书。

`certs/` 已被 `.gitignore` 排除，证书和私钥均不提交。也可运行 `pnpm certs:generate` 预先生成证书。需要系统中可用的 OpenSSL。

手机访问 HTTPS 之前，先将 `certs/root-ca.pem` 导入访问设备并明确设为受信任根证书。iPhone/iPad 安装证书描述文件后，还需在「设置 → 通用 → 关于本机 → 证书信任设置」中开启完全信任；其他设备使用对应的证书安装设置。只分发根 CA 公共证书，勿分发任何 `*-key.pem` 私钥。所有子应用共用同一 CA，信任一次即可。

使用 `https://开发机器IP:7100` 访问父应用，或 `https://开发机器IP:7103` 访问文字世界。浏览器需支持语音识别且允许麦克风权限；HTTPS 本身不会代替权限授权。

更换网络/IP 后，停止前端服务，删除 `certs/server.pem` 和 `certs/server-key.pem`，设置需要的 `VITE_PUBLIC_HOST` 并重新启动，即可用原根 CA 签发新证书，无需重新信任根 CA。
