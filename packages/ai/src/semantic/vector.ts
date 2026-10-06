/**
 * 向量运算。
 *
 * 句向量有两个反直觉的性质，这里提供对应的工具：
 *   1. 嵌入模型输出的向量通常已归一化，但多次运算后需要再归一；
 *   2. **各向异性**：同一模型下任意两句的余弦都在 0.8~0.99（实测 e5-small），
 *      因为所有句子共享一个巨大的「公共语义方向」。直接比余弦没有区分力，
 *      必须先用 subtractProjection 减掉这个公共方向。
 */

export type Vector = Float32Array;

export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

/** 归一化；零向量原样返回，避免出现 NaN */
export function unit(v: Vector): Vector {
  const norm = Math.sqrt(dot(v, v));
  const out = new Float32Array(v.length);
  if (norm === 0) return out;
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] / norm;
  return out;
}

/** 去掉 v 在 axis 方向上的分量（axis 必须是单位向量） */
export function subtractProjection(v: Vector, axis: Vector): Vector {
  const k = dot(v, axis);
  const out = new Float32Array(v.length);
  for (let i = 0; i < v.length; i += 1) out[i] = v[i] - axis[i] * k;
  return out;
}

/** 余弦相似度（对未归一化向量同样成立） */
export function cosine(a: Vector, b: Vector): number {
  const na = Math.sqrt(dot(a, a));
  const nb = Math.sqrt(dot(b, b));
  if (na === 0 || nb === 0) return 0;
  return dot(a, b) / (na * nb);
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
