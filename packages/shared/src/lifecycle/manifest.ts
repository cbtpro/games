/** 子游戏的静态描述，注册到平台时用得上 */
export interface GameManifest {
  /** 全局唯一编码，例如 game-template；也是 qiankun 的 app name */
  code: string;
  name: string;
  version: string;
  description?: string;
  category?: string;
  /** 最小 / 最大玩家数 */
  minPlayers?: number;
  maxPlayers?: number;
  /** 声明自己支持的生命周期钩子，便于平台做能力探测 */
  capabilities?: string[];
}
