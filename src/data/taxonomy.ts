// 康复课题二级分类 + 风格 + 比例 + 页数

export interface Topic {
  key: string;
  name: string;
}

export const TOPICS: Topic[] = [
  { key: 'language', name: '语言沟通' },
  { key: 'social', name: '社交交往' },
  { key: 'selfcare', name: '生活自理' },
  { key: 'cognition', name: '认知与精细动作' },
];

export function topicName(key: string): string {
  return TOPICS.find((t) => t.key === key)?.name || key;
}

export interface StyleDef {
  key: string;
  name: string;
  suffix: string; // 生图提示词风格后缀
}

export const STYLES: StyleDef[] = [
  {
    key: 'warm',
    name: '暖色手绘',
    suffix:
      '温暖柔和的手绘儿童插画风格，蜡笔与水彩质感，暖色调，圆润友好，光线柔和，构图简洁，适合特需儿童；不要出现任何文字、字母或水印；不要霓虹色、不要塑料质感、不要3D渲染。',
  },
  {
    key: 'flat',
    name: '扁平简洁',
    suffix:
      '扁平化矢量插画风格，简洁干净，低饱和柔和配色，粗细均匀的描边，单一主体居中，适合教学图卡；画面内不要任何文字、字母或水印。',
  },
  {
    key: 'watercolor',
    name: '水彩',
    suffix:
      '柔美水彩插画风格，晕染质感，温柔淡雅的色彩，充满童趣，画面温馨；不要任何文字、字母或水印，不要3D渲染。',
  },
  {
    key: 'line',
    name: '黑白线描',
    suffix:
      '极简黑白线描插画，粗细均匀的黑色描边，纯白背景，单一主体居中，简洁清晰，适合特需儿童视觉教学；画面内不要任何文字、字母或水印。',
  },
];

export function styleName(key: string): string {
  return STYLES.find((s) => s.key === key)?.name || key;
}

export function styleSuffix(key: string): string {
  return STYLES.find((s) => s.key === key)?.suffix || STYLES[0].suffix;
}

export const COMMON_NEGATIVE =
  '文字，字母，水印，logo，霓虹色，高饱和，塑料感，3D渲染，恐怖，暴力，多余的手指，畸形';

// 画面比例 → DashScope size
export const RATIOS: { label: string; value: string; size: string }[] = [
  { label: '1:1', value: '1:1', size: '1024*1024' },
  { label: '4:3', value: '4:3', size: '1280*960' },
  { label: '16:9', value: '16:9', size: '1280*720' },
];
export const DEFAULT_RATIO = '4:3';

export function sizeForRatio(ratio: string): string {
  return RATIOS.find((r) => r.value === ratio)?.size || '1024*1024';
}

export const PAGE_COUNTS = [4, 6, 8];
export const DEFAULT_PAGE_COUNT = 4;
