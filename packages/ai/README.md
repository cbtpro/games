# @games/ai

子游戏共用的**浏览器内 AI 能力**：本地语义模型加载、向量运算、语义坐标判定。
推理全程在浏览器完成，**没有后端参与**。

```
model/     句子 → 向量（模型懒加载、实例共享、向量缓存）
semantic/  语义坐标系（多组锚点建系、语义轴评分、降级组合）
react/     接进 React 的钩子
```

## 快速上手：给游戏加一种「文字品味」

```tsx
import { useSemanticReading } from '@games/ai';

const { status, analyze } = useSemanticReading({
  axes: [
    {
      key: 'epic',
      positive: ['大漠孤烟直，长河落日圆', '风萧萧兮易水寒'],
      negative: ['今天天气不错', '我去吃饭了'],
    },
  ],
});

// status: { phase: 'loading' | 'ready' | 'failed', progress, usingAi }
const reading = await analyze('落霞与孤鹜齐飞');
reading.axes.epic; // 0~1，越接近 positive 端越高
```

就这些。模型会在挂载后后台下载，没好之前 `analyze` 走你传入的 `fallback`。

## 三种用法

| 场景 | 用什么 |
| --- | --- |
| 只想量几条轴 | `useSemanticReading(options)` |
| 要自定义输出结构 / 自定义兜底 | `useSemanticAnalyzer(factory, deps)` |
| 不用 React（如在引擎里） | `new SemanticAnalyzer(options)` / `new AnchorSpace(...)` |

### 自定义输出结构

游戏往往有自己的画像结构。做法是写一个薄适配器，把公共读数翻译成自己的结构：

```ts
class MyTaste implements TextAnalyzer<MyProfile> {
  private analyzer = new SemanticAnalyzer({ axes: MY_AXES, model });
  analyze = async (text, history = []) => {
    const reading = await this.analyzer.analyze(text, history);
    return { epic: reading.axes.epic ?? 0, source: reading.source };
  };
  // ready / broken / warmUp / dispose 直接转发
}
```

喂蜘蛛的 `apps/games/game-spider/src/ai/semanticTaste.ts` 就是这个模式的实例。

### 降级

```ts
const analyzer = withFallback(new SemanticAnalyzer(options), new MyRuleBasedAnalyzer());
```

两个分析器产出同一种结构，上层完全感觉不到切换；模型就绪后自动接管。

## 关键设计：为什么锚点是「坐标」而不是「词表」

句向量有强**各向异性**：同一模型下任意两句余弦都在 0.81~0.99（e5-small 实测），
绝对阈值毫无区分力。`AnchorSpace` 在建系时先算出所有锚点的公共方向，
之后所有向量都先减掉它再比较，可比区间从 0.03 拉到 0.9 以上。

因此判定是**泛化**而不是匹配：没收录过的句子只要落在某个方向附近就能认出来。

> ⚠️ 语义向量分不出「词语堆砌」。排比罗列句在语义空间里甚至比真诗更"意象鲜明"。
> 这类要靠结构信号（重复片段、长串无句读），见 `game-spider/src/domain/textShape.ts`。

## 模型来源

默认 `Xenova/multilingual-e5-small`（int8，约 110MB），首次下载后由浏览器缓存。

| 方式 | 配置 |
| --- | --- |
| 远程 CDN | 默认 |
| 镜像站 | `VITE_HF_HOST=https://hf-mirror.com/` |
| 随应用分发 | `node scripts/fetch-semantic-model.mjs --mirror` + `VITE_HF_LOCAL=true` |

## 新游戏接入清单

1. `package.json` 加 `"@games/ai": "workspace:*"`
2. `vite.config.ts`：
   ```ts
   import { assetOriginDefine, semanticModelConfig } from '../../../tools/vite/semanticModel';
   export default defineConfig(({ command }) => ({
     define: assetOriginDefine(command === 'serve' ? `http://127.0.0.1:${DEV_PORT}` : ''),
     ...semanticModelConfig,
   }));
   ```
   第 2 步**不能省**：被 qiankun 宿主加载时 `import.meta.url` 会退化成 blob: URL，
   运行时推不出自己的资源地址，模型会请求到宿主域名上拿到 HTML。
3. 用上面任意一个钩子。
