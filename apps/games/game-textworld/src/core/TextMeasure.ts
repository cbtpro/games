import type { Size, TextFont } from './types';

/** 文字测量接口。核心引擎通过注入的实现获取尺寸，不依赖 Canvas 或 DOM。 */

export interface ITextMeasure {
  measure(text: string, font: TextFont): Size;
}

/**
 * 无 DOM 的近似实现：只在拿不到 Canvas 时兜底（测试、SSR、核心算法单测）。
 * 中文按 1 个字宽、西文按 0.55 个字宽估算，够用来跑布局，不够用来渲染。
 */
export class ApproximateTextMeasure implements ITextMeasure {
  measure(text: string, font: TextFont): Size {
    let units = 0;
    for (const char of text) {
      units += /[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.55;
    }
    return { width: Math.ceil(units * font.size), height: font.lineHeight };
  }
}
