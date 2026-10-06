/**
 * 文本的形态统计。
 *
 * 与「语义」相对：这里只看字面特征（长度、用字多样性、句读、是否乱敲），
 * 不判断含义，也不需要任何词表。
 *
 * 语义由 AI 模型负责（见 src/ai），形态由这里负责 —— 两者合成最终判断。
 * 好处很实在：AI 没加载完、或压根不可用时，光靠形态也能玩。
 */

/** 一眼假的字面模式：纯数字、纯标点、重复字、键盘乱敲 */
const GIBBERISH_PATTERNS: readonly RegExp[] = [
  /^(.)\1{2,}$/u, // 哈哈哈 / aaa
  /^\d+$/u, // 纯数字
  /^[\p{P}\p{S}\s]+$/u, // 纯标点
  /^(asdf|qwer|zxcv|abc|abcd|1234|aaaa)[0-9a-z]*$/i, // 键盘乱敲
  /^(.)(.)\1\2$/u, // abab 型
];

/** 重复出现的片段，是「排比堆砌」的痕迹 */
export interface RepeatedFragment {
  fragment: string;
  /** 出现次数 */
  times: number;
  /** 这些片段覆盖了全文多少比例 */
  coverage: number;
}

export interface TextShape {
  /** 字符数（按 Unicode 码点，中文一个字算一个） */
  chars: number;
  /** 中日韩字符占比 0~1 */
  cjk: number;
  /** 不重复字符占比 0~1，越低说明越啰嗦 */
  uniqueness: number;
  /** 有句读 */
  punctuated: boolean;
  /** 中式对仗：逗号分隔的两截字数相同 */
  antithetical: boolean;
  /** 一眼假的乱敲内容 */
  gibberish: boolean;
  /** 重复片段（如「红色的X蓝色的Y绿色的Z」里的「色的」）；没有则为 null */
  repeated: RepeatedFragment | null;
  /** 长串却没有任何句读：像句子又断不开 */
  runon: boolean;
}

/** 长到需要句读却没有句读的下限 */
const RUNON_MIN_CHARS = 12;
/** 只找这个长度范围内的重复片段，太短是巧合、太长是整句复述 */
const REPEAT_MIN_LEN = 2;
const REPEAT_MAX_LEN = 6;

/**
 * 找出覆盖率最高的重复片段。
 *
 * 真诗文几乎不会出现「同一个 2~6 字片段复现 3 次以上」——
 * 而词语堆砌恰恰靠这个（红色的…蓝色的…绿色的…）。
 * 注意计的是**片段**出现次数而不是单字：「苍苍」「处处」这类叠词只算 1 次，
 * 因此不会误伤含叠词的名句。
 */
function findRepeated(chars: string[]): RepeatedFragment | null {
  if (chars.length < REPEAT_MIN_LEN * 2) return null;

  let best: RepeatedFragment | null = null;
  for (let len = REPEAT_MIN_LEN; len <= REPEAT_MAX_LEN; len += 1) {
    const counts = new Map<string, number>();
    for (let i = 0; i + len <= chars.length; i += 1) {
      const fragment = chars.slice(i, i + len).join('');
      counts.set(fragment, (counts.get(fragment) ?? 0) + 1);
    }
    for (const [fragment, times] of counts) {
      if (times < 2) continue;
      const coverage = (times * len) / chars.length;
      // 覆盖率相同时偏向更长的片段：更长的重复更能说明是套话
      if (!best || coverage > best.coverage + 0.001) {
        best = { fragment, times, coverage };
      }
    }
  }
  return best;
}

const CJK = /[㐀-䶿一-鿿]/u;

export function shapeOf(raw: string): TextShape {
  const text = raw.trim();
  const chars = [...text];
  const count = chars.length;

  const cjkCount = chars.filter((char) => CJK.test(char)).length;
  const unique = new Set(chars).size;

  const parts = text
    .split(/[，,、；;]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const punctuated = /[，。！？、；：,!?;:]/.test(text);

  return {
    chars: count,
    cjk: count === 0 ? 0 : cjkCount / count,
    uniqueness: count === 0 ? 0 : unique / count,
    punctuated,
    antithetical:
      parts.length >= 2 && parts.every((part) => [...part].length === [...parts[0]].length),
    gibberish: GIBBERISH_PATTERNS.some((pattern) => pattern.test(text)),
    repeated: findRepeated(chars),
    runon: count >= RUNON_MIN_CHARS && !punctuated,
  };
}

/**
 * 形态带来的「体量分」0~1：太短撑不起一句诗，够长才谈得上意境。
 * 只描述体量，不评价好坏。
 */
export function volumeOf(shape: TextShape): number {
  const { chars } = shape;
  if (chars >= 12) return 1;
  if (chars >= 8) return 0.85;
  if (chars >= 5) return 0.65;
  if (chars >= 4) return 0.5;
  if (chars >= 3) return 0.35;
  if (chars === 2) return 0.2;
  return 0.1;
}

/**
 * 四字凝练：全中文、字字不重复的四字格 —— 成语的典型形态。
 * 短文本在语义空间里天然信号弱，靠这一条给成语兜底。
 */
export function isTerseIdiom(shape: TextShape): boolean {
  return shape.chars === 4 && shape.cjk > 0.9 && shape.uniqueness === 1;
}

/** 重复片段按出现次数折算的堆砌度 */
const PATCHWORK_BY_TIMES = [{ times: 3, value: 0.5 }, { times: 2, value: 0.25 }];
/** 长串无句读本身就是「一坨」的强信号 */
const RUNON_PATCHWORK = 0.45;
/** 堆砌度超过这条线，直接判定为凑字数 */
export const PATCHWORK_LIMIT = 0.5;

/**
 * 「东拼西凑」的程度 0~1。
 *
 * 语义模型分不出堆砌（实测：堆砌句与名句在语义空间的亲和度完全重叠），
 * 但**结构**分得出来：词语罗列必然留下重复片段，长串堆砌必然没有句读。
 * 这两条都不依赖任何词表，换语言、换题材都成立。
 */
export function patchworkOf(shape: TextShape): number {
  // 拉丁语系靠空格断句、也常用重复做修辞（to be or not to be），
  // 因此「无句读」只对中文为主的文本扣分，英文只认明显的多次重复。
  const cjk = shape.cjk >= 0.5;
  let value = cjk && shape.runon ? RUNON_PATCHWORK : 0;

  const repeated = shape.repeated;
  if (repeated) {
    const hit = PATCHWORK_BY_TIMES.find((row) => repeated.times >= row.times);
    if (hit && (cjk || repeated.times >= 3)) value += hit.value;
  }

  return Math.min(1, value);
}
