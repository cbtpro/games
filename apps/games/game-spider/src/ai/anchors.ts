/**
 * 蜘蛛的「味觉坐标」。
 *
 * 这里**不是**匹配用的词表。这些句子会被语义模型编码成向量，
 * 在语义空间里围出两块区域：
 *   佳肴区 = 什么样的文字算有文学价值
 *   敷衍区 = 什么样的文字算敷衍了事
 * 任何输入都与这两块区域比语义距离，因此**没收录过的句子也能认出来**
 * （实测：从未出现在锚点里的名句依然能拿到高分，大白话则拿不到）。
 *
 * 组成：少量「语义描述」定方向 + 一批「范例名句」定区域密度。
 * 想让蜘蛛更博学，往这里加例句即可，判定逻辑一行都不用改。
 */

/** e5 系列模型约定：被比较的文本加 passage 前缀（两侧对称使用才可比） */
export const PASSAGE_PREFIX = 'passage: ';

/** 佳肴区：古典诗词范例（定义「什么是好文字」的坐标点） */
const POETRY_SAMPLES: readonly string[] = [
  '白日依山尽，黄河入海流',
  '红豆生南国，春来发几枝',
  '飞流直下三千尺，疑是银河落九天',
  '两个黄鹂鸣翠柳，一行白鹭上青天',
  '停车坐爱枫林晚，霜叶红于二月花',
  '月落乌啼霜满天，江枫渔火对愁眠',
  '清明时节雨纷纷，路上行人欲断魂',
  '劝君更尽一杯酒，西出阳关无故人',
  '孤帆远影碧空尽，唯见长江天际流',
  '离离原上草，一岁一枯荣',
  '谁知盘中餐，粒粒皆辛苦',
  '欲穷千里目，更上一层楼',
  '两岸猿声啼不住，轻舟已过万重山',
  '天苍苍野茫茫，风吹草低见牛羊',
  '小荷才露尖尖角，早有蜻蜓立上头',
];

/** 佳肴区：格言典故范例 */
const APHORISM_SAMPLES: readonly string[] = [
  '千里之行，始于足下',
  '己所不欲，勿施于人',
  '温故而知新，可以为师矣',
  '海内存知己，天涯若比邻',
  '先天下之忧而忧，后天下之乐而乐',
];

/** 佳肴区：直接用自然语言描述「什么算好文字」——这是泛化的关键 */
const REFINED_DESCRIPTIONS: readonly string[] = [
  '一句意境优美的中国古典诗词',
  '凝练典雅的成语或历史典故',
  '富有哲理与画面感的文学名句',
  '文辞雅致、意象鲜明的抒情短句',
  '对仗工整、音韵和谐的联句',
  '饱含人生感悟与哲思的句子',
  'a beautiful and evocative line of classical poetry',
  'an elegant literary aphorism rich in imagery',
];

export const REFINED_ANCHORS: readonly string[] = [
  ...POETRY_SAMPLES,
  ...APHORISM_SAMPLES,
  ...REFINED_DESCRIPTIONS,
];

/** 敷衍区：描述为主，范例补足 */
export const VULGAR_ANCHORS: readonly string[] = [
  '毫无意义的字符乱敲',
  '敷衍了事的口头禅',
  '随手输入的测试内容',
  '重复啰嗦、没有任何信息量的一句话',
  '应付式的闲聊与客套',
  '键盘上随便按出来的字母组合',
  '纯粹凑字数、不知所云的文本',
  '没有实质内容的寒暄客套话',
  'meaningless random characters typed carelessly',
  'a lazy filler message with no real content',
  '嘿嘿嘿',
  '哦哦哦',
  'abcd1234',
  'qwerty',
  '来了来了',
  '就是就是',
];
