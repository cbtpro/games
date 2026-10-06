import type { SemanticProfile } from '../ai/types';
import { PATCHWORK_LIMIT, isTerseIdiom, patchworkOf, shapeOf, volumeOf } from './textShape';
import type { VerdictGrade, WordVerdict } from './types';

/**
 * 蜘蛛的味蕾。
 *
 * 纯函数：输入「语义画像 + 字面形态 + 当前挑食等级」，输出判定结论。
 * 它不关心语义画像是模型算的还是规则算的（见 src/ai），
 * 换模型、换判定策略都不需要动这里。
 */

/** 挑食等级越高，嘴巴越刁 */
export interface Palate {
  level: number;
  /** 入口门槛分 */
  minScore: number;
  /** 当前等级不吃的类型，用于 UI 提示 */
  dislikes: string[];
}

/** 计分权重：语义为主，形态为辅 */
const WEIGHT = { semantic: 0.75, form: 0.25 };
/** 形态分的构成：体量占一半，句读与对仗各占四分之一 */
const FORM_PART = { volume: 0.5, punctuated: 0.25, antithetical: 0.25 };

/**
 * 语义重复阈值（模型给出的余弦相似度）。
 * 这是「越吃越挑食」的另一半：不是同一个字符串才算重复，
 * 语义上撞车了也算 —— 换个说法再喂同一句诗，它一样不买账。
 */
const FAMILIARITY_SEVERE = 0.86;
const FAMILIARITY_MILD = 0.66;

/** 判定为「敷衍」的语义敷衍度门槛 */
const JUNK_LIMIT = 0.72;
/** 低于此语义分视为大白话（高等级拒吃） */
const PLAIN_LIMIT = 0.45;

/**
 * 「东拼西凑」的折扣。
 *
 * 语义模型认不出堆砌 —— 一句「红色的苹果蓝色的天空绿色的草地」在语义空间里
 * 甚至比真诗更贴近「意象鲜明」（实测亲和度 0.29，接近名句）。
 * 但结构骗不了人：它长、没句读、还有重复片段。因此堆砌只在**结构**上扣分：
 *   1. 长串无句读：文学分与体量分都打折（模型给的分不可信）；
 *   2. 重复片段：整句分再打一次折；
 *   3. 堆砌度过高：直接判死，不给分。
 */
const RUNON_LITERARY_FACTOR = 0.6;
const RUNON_VOLUME_FACTOR = 0.6;
const PATCHWORK_PENALTY = 0.6;

/** 分档阈值：按实测样本分布定（长名句 80+，完整短句 ~50，大白话 <30） */
const GRADE_BY_SCORE = [
  { min: 72, grade: 'delicacy' as VerdictGrade },
  { min: 46, grade: 'tasty' as VerdictGrade },
  { min: 30, grade: 'bland' as VerdictGrade },
  { min: 0, grade: 'junk' as VerdictGrade },
];

function gradeOf(score: number): VerdictGrade {
  return GRADE_BY_SCORE.find((row) => score >= row.min)?.grade ?? 'junk';
}

/**
 * 挑食曲线：吃到的佳肴越多，等级越高。
 * 等级不只抬高门槛，还会逐条禁用「太容易」的表达。
 */
export function nextPalate(delicaciesEaten: number, difficultyFactor = 1): Palate {
  const level = Math.min(9, 1 + Math.floor(delicaciesEaten / 2));
  const minScore = Math.min(88, Math.round((28 + level * 7) * difficultyFactor));
  const dislikes: string[] = [];

  if (level >= 2) dislikes.push('单个字已经不够塞牙缝');
  if (level >= 3) dislikes.push('大白话恕不奉陪');
  if (level >= 4) dislikes.push('少于 7 个字的短句看不上');
  if (level >= 5) dislikes.push('要有标点、对仗或典故');
  if (level >= 6) dislikes.push('换个说法也不行，语义撞车就走');

  return { level, minScore, dislikes };
}

export interface JudgeInput {
  text: string;
  palate: Palate;
  /** 语义画像（由 src/ai 异步产出后传进来） */
  profile: SemanticProfile;
}

/**
 * 鉴定一段文字值多少钱。
 *
 * 语义（模型理解）占大头，字形体量（句读、对仗、长度）占小头，
 * 再按「吃过没有」扣新鲜度。任何一路出问题都会扣分，
 * 但不会因为单一原因直接判死 —— 这样玩家总能明白自己输在哪。
 */
export function judgeText({ text, palate, profile }: JudgeInput): WordVerdict {
  const value = text.trim();
  const tags: string[] = [];

  if (value.length === 0) {
    return { grade: 'junk', score: 0, tags: ['空的'], reason: '连个字都没有', edible: false };
  }

  const shape = shapeOf(value);
  const chars = [...value];

  // ---------------------------------------------------------------- 字面硬伤
  if (shape.gibberish) {
    return {
      grade: 'junk',
      score: 4,
      tags: ['乱敲'],
      reason: '这种随手敲的东西，蜘蛛连头都不回',
      edible: false,
    };
  }

  // ---------------------------------------------------------------- 语义敷衍
  if (profile.junk >= JUNK_LIMIT) {
    return {
      grade: 'junk',
      score: Math.round(profile.literary * 30),
      tags: ['敷衍'],
      reason: '蜘蛛闻了闻，转身就走',
      edible: false,
    };
  }

  // ---------------------------------------------------------------- 结构折扣
  const patchwork = patchworkOf(shape);
  if (patchwork >= PATCHWORK_LIMIT) {
    const detail = shape.repeated
      ? `「${shape.repeated.fragment}」重复了 ${shape.repeated.times} 次`
      : '一大串文字连个标点都没有';
    return {
      grade: 'junk',
      score: 0,
      tags: ['东拼西凑'],
      reason: `东拼西凑：${detail}，蜘蛛不吃`,
      edible: false,
    };
  }

  // ---------------------------------------------------------------- 基础分
  const volume = volumeOf(shape) * (shape.runon ? RUNON_VOLUME_FACTOR : 1);
  const form =
    volume * FORM_PART.volume +
    (shape.punctuated ? FORM_PART.punctuated : 0) +
    (shape.antithetical ? FORM_PART.antithetical : 0) +
    // 四字成语在语义空间里吃亏（信息量小、向量靠近中心），靠形态补回来
    (isTerseIdiom(shape) ? 0.24 : 0);

  // 无句读的长串：模型给的文学分要打折（堆砌同样「意象鲜明」）
  const literary = profile.literary * (shape.runon ? RUNON_LITERARY_FACTOR : 1);

  let score = 100 * (literary * WEIGHT.semantic + form * WEIGHT.form);

  // 堆砌度统一折算：重复片段、无句读长串，都按比例扣分
  if (patchwork > 0) score *= 1 - patchwork * PATCHWORK_PENALTY;

  // ---------------------------------------------------------------- 新鲜度
  const repeated = profile.familiarity >= FAMILIARITY_SEVERE;
  const reminiscent = !repeated && profile.familiarity >= FAMILIARITY_MILD;
  if (repeated) {
    score -= 45;
    tags.push('语义撞车');
  } else if (reminiscent) {
    score -= 22;
    tags.push('似曾相识');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeOf(score);

  // 语义来源标注，让玩家看到这一口是谁判的
  tags.unshift(profile.source === 'ai' ? `语义 ${score}` : `应急 ${score}`);

  // ---------------------------------------------------------------- 挑食门槛
  if (grade === 'junk') {
    return { grade, score, tags, reason: '蜘蛛闻了闻，转身就走', edible: false };
  }

  const singleChar = chars.length === 1;
  const plain = profile.literary < PLAIN_LIMIT;

  if (palate.level >= 2 && singleChar) {
    return {
      grade,
      score,
      tags,
      reason: `Lv${palate.level} 的嘴：单个字已经不够塞牙缝`,
      edible: false,
    };
  }
  if (palate.level >= 3 && plain) {
    return {
      grade,
      score,
      tags,
      reason: `Lv${palate.level} 的嘴：大白话恕不奉陪`,
      edible: false,
    };
  }
  if (palate.level >= 4 && chars.length < 7) {
    return {
      grade,
      score,
      tags,
      reason: `Lv${palate.level} 的嘴：少于 7 个字看不上`,
      edible: false,
    };
  }
  if (palate.level >= 5 && !shape.punctuated && !shape.antithetical) {
    return {
      grade,
      score,
      tags,
      reason: `Lv${palate.level} 的嘴：要有标点、对仗或典故`,
      edible: false,
    };
  }
  if (palate.level >= 6 && reminiscent) {
    return {
      grade,
      score,
      tags,
      reason: `Lv${palate.level} 的嘴：这句话的意思它吃过了`,
      edible: false,
    };
  }
  if (repeated) {
    return { grade, score, tags, reason: '这道菜上过了，换个新的', edible: false };
  }

  if (score < palate.minScore) {
    return {
      grade,
      score,
      tags,
      reason: `差一口气 —— 需要 ${palate.minScore} 分，你给了 ${score} 分`,
      edible: false,
    };
  }

  return {
    grade,
    score,
    tags,
    reason:
      grade === 'delicacy'
        ? '好东西！蜘蛛八条腿都在抖'
        : grade === 'tasty'
          ? '味道不错，咽下去了'
          : '勉强能充饥',
    edible: true,
  };
}

/** 进食得分：越好的文字给越多分，挑食等级越高，同样文字得分越高 */
export function scoreOf(verdict: WordVerdict, palate: Palate): number {
  const base = Math.round(verdict.score * 0.6);
  const bonus = verdict.grade === 'delicacy' ? 20 : verdict.grade === 'tasty' ? 8 : 0;
  return (base + bonus) * palate.level;
}
