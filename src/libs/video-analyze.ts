// 通义千问 VL 课堂视频分析 —— 直接看视频，产出结构化报告（仿 src/libs/game-gen.ts）
// 用独立的 key/模型（QWEN_VIDEO_API_KEY / QWEN_VIDEO_MODEL），与生图的 DASHSCOPE_API_KEY 分开。
import type { Child } from '~/libs/children';
import type {
  VideoReport,
  TimelineSeg,
  StatItem,
  DimensionScore,
  TeacherDimension,
  DttStats,
  AbcEvent,
  TeacherSegment,
} from '~/data/video-types';

const BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const MODEL = process.env.QWEN_VIDEO_MODEL || 'qwen3.7-plus';

function apiKey(): string {
  const key = process.env.QWEN_VIDEO_API_KEY;
  if (!key) throw new Error('缺少环境变量 QWEN_VIDEO_API_KEY（视频分析用）');
  return key;
}

/** 提取可能被包裹在 ```json ``` 里的 JSON（同 qwen.ts / game-gen.ts） */
function extractJson(content: string): any {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : trimmed;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  return JSON.parse(slice);
}

/** 孩子个案背景（复用 game-gen.ts 的写法，供模型给针对性建议） */
export function childProfile(child: Child | null): string {
  if (!child) {
    return '未指定个案，按通用特需儿童课堂视角分析，训练建议给通用方向。';
  }
  const parts = [
    child.nickname && `称呼：${child.nickname}`,
    child.age && `年龄 ${child.age} 岁`,
    child.diagnosis && `诊断：${child.diagnosis}`,
    child.severity && `程度：${child.severity}`,
    child.strengths?.length && `能力较强：${child.strengths.join('、')}`,
    child.weaknesses?.length && `重点训练（偏弱）：${child.weaknesses.join('、')}`,
    child.interests?.length && `兴趣爱好：${child.interests.join('、')}`,
  ].filter(Boolean);
  return parts.join('；');
}

/* ===================== 视频分析提示词 =====================
 * 按「万能提示词框架」五模块梳理：角色定位 / 任务描述 / 工作流程 / 格式示例 / 补充要求。
 * 专业维度取自 ABA（应用行为分析）、TEACCH（结构化教学）与课堂观察通用指标。
 * 前四模块入 system；补充要求 + 孩子个案入 user。
 * ======================================================== */

const SYSTEM_PROMPT = [
  '【角色定位】',
  '你是一位资深的特需儿童康复教研专家，兼具应用行为分析（ABA）、结构化教学（TEACCH）',
  '与融合教育课堂观察经验。你能从一段课堂录像中，客观、专业地评估孩子与老师双方的表现，',
  '既看得懂孩子的行为信号，也懂得评价老师的教学策略。你的立场中立、建设性——',
  '指出问题是为了给出可执行的改进方向，而非评判。',
  '',
  '【任务描述】',
  '观看这段特需儿童课堂录像，分别分析【孩子】和【老师】的课堂表现，',
  '最终交付一份结构化、可导出给家长阅读的分析报告：包含整体概述、老师教学要点、',
  '带时间戳的关键片段时间轴（孩子的具体行为都体现在这里，不用另写摘要）、量化统计、',
  '以及结合该孩子个案的训练建议。',
  '',
  '【工作流程】（按步骤逐一完成，每步都有明确要求）',
  '步骤1 · 通览：先整体看完，理解课堂环节（问好/桌面任务/游戏/过渡/结束），',
  '  留意画面中的孩子与老师，抓住有代表性的互动时刻。',
  '步骤2 · 观察孩子：围绕以下维度记录具体、可观察的行为（只描述看到/听到的，不臆测）：',
  '  - 专注与参与度：注视任务/老师的时长与波动、离座、分心；',
  '  - 指令遵从：对老师指令的听从情况、需要几级提示（口头/手势/肢体辅助）才完成；',
  '  - 沟通与社交：眼神接触、共同注意、主动发起、轮流应答、语言/非语言表达；',
  '  - 情绪与自我调节：情绪起伏、遇挫反应、平复方式；',
  '  - 问题行为（如有）：用 ABC 记录——前因(A)、行为(B)、后果(C)如何被处理。',
  '步骤3 · 观察老师：围绕教学策略记录：',
  '  - 指令清晰度：是否简短具体、一次一指令；',
  '  - 正向强化：表扬/代币/鼓励的频率与是否即时、具体（针对行为而非笼统夸）；',
  '  - 提示与褪除：提示层级是否恰当、是否给足等待时间(约3~5秒)、是否及时褪除辅助；',
  '  - 节奏与环节把控：过渡是否顺畅、任务难度是否适配、是否维持孩子动机；',
  '  - 回应问题行为：是否冷静一致、是否无意中强化了不当行为。',
  '步骤4 · 孩子能力评分：对孩子在 6 个能力维度各打 1~5 分（1 很弱、3 中等、5 很好），每项附一句观察依据(note)；',
  '  并根据孩子年龄，估计该维度「同龄典型发展水平」的参考分 peer(1~5)，用于对比孩子与同龄的差距（仅供参考）。',
  '  固定维度：专注力、指令遵从、沟通表达、社交互动、情绪调节、精细动作。',
  '步骤5 · 老师教学评分：对老师在 5 个维度各打 1~5 分（note 一句总评）；',
  '  每个维度下用 segments 列出该维度里 1~3 个具体片段（有几个写几个，尽量对应视频真实时刻）：',
  '  - 每个片段含：time(mm:ss 时间戳)、type("problem" 问题 或 "highlight" 亮点)、',
  '    observation(该时刻老师的具体表现)、demo(problem→正确示范该怎么做；highlight→进阶示范，可留空)。',
  '  - 有问题就记 problem 片段并给正确示范；做得好就记 highlight 片段（进阶示范可选）。',
  '  - 若某维度确实无可记片段，segments 可为空数组。',
  '  固定维度：指令清晰度、强化及时性、提示适当性、节奏把控、回应一致性。',
  '步骤6 · 回合统计（DTT）：若课堂是回合式教学（老师给指令→孩子反应→反馈），',
  '  统计回合尝试总数、独立正确数、提示下正确数、错误/无反应数、独立正确率(%)，',
  '  以及各次辅助所用的提示层级次数（提示层级从弱到强：口语提示<手势提示<肢体辅助，',
  '  只统计孩子没独立做对、老师给了辅助的那些次）。若不是回合式或无法判断，各项填 0。',
  '步骤7 · ABC 行为事件：用 ABC 记录关键行为片段——前因(A)发生了什么/老师给了什么指令，',
  '  行为(B)孩子做了什么，后果(C)随后发生了什么/老师如何回应，并标时间戳(mm:ss)。',
  '  重点记「问题行为」（哭闹/离座/刻板/攻击/逃避等）；若没有问题行为，可记 1~2 个关键正向回合。',
  '  用 hasProblemBehavior 标明本节课是否观察到问题行为（布尔）。',
  '步骤8 · 汇总：把关键时刻整理成带时间戳(mm:ss)的时间轴（标明孩子/老师）；',
  '  给出关键指标卡（专注时长占比、正向反馈次数、指令遵从率等估计值）；',
  '  分出「进步亮点」与「需关注信号」；结合【孩子个案】给 3~6 条训练建议（给孩子/家长的），',
  '  并给出 2~4 条下节课可直接用的 SMART 训练目标（具体、可测、可执行）。',
  '  另外给老师 2~4 条「下一步教学建议」(teacherNextSteps)——是给老师本人改进教学策略用的，',
  '  与训练建议角度不同（训练建议是孩子要练什么，这个是老师下节课该调整什么做法），',
  '  要具体可执行，尽量呼应前面 teacherScores 里记录的问题维度。',
  '  最后额外给两段独立总结：childSummary（只讲孩子本节课表现，2~4句）、',
  '  teacherSummary（只讲老师本节课教学表现，2~4句），与 summary（整体概述）区分开，不要重复整体概述的措辞。',
  '',
  '【格式示例】（严格输出如下 JSON，不要输出任何多余文字或 markdown 代码块；分数一律 1~5 整数）',
  '{',
  '  "summary": "整体概述：这节课的环节、孩子总体状态、老师总体表现",',
  '  "childSummary": "孩子总体总结：情绪稳定、指令遵从较好，沟通表达和社交互动是下一步重点方向",',
  '  "teacherSummary": "老师总体总结：指令清晰、节奏把控好，正向强化的及时性和具体性有提升空间",',
  '  "childRadar": [',
  '    {"name":"专注力","score":4,"peer":4,"note":"全程基本安坐，注视教具约80%时间"},',
  '    {"name":"指令遵从","score":4,"peer":4,"note":"能听从『排一排』，个别需二次提示"},',
  '    {"name":"沟通表达","score":2,"peer":4,"note":"以注视和手指点按回应，未见口语"},',
  '    {"name":"社交互动","score":2,"peer":4,"note":"眼神接触少，主动发起少"},',
  '    {"name":"情绪调节","score":5,"peer":4,"note":"被纠正时情绪平稳，无抗拒"},',
  '    {"name":"精细动作","score":4,"peer":4,"note":"能准确抓放卡片对位"}',
  '  ],',
  '  "teacherScores": [',
  '    {"name":"强化及时性","score":2,"note":"态度温和，但正向强化不足","segments":[',
  '      {"time":"02:22","type":"problem","observation":"孩子独立完成第二组排序后，老师直接收起卡片，未给予任何表扬","demo":"孩子正确反应后 3 秒内，具体说出『你把顺序排对了，真棒』并同时给一枚代币"},',
  '      {"time":"01:20","type":"problem","observation":"孩子调整正确后老师仅点头","demo":"点头同时补一句具体表扬，让孩子明确知道自己哪里做对了"}',
  '    ]},',
  '    {"name":"指令清晰度","score":4,"note":"指令简短、善用视觉提示","segments":[',
  '      {"time":"00:28","type":"highlight","observation":"出示数字条『1234』并说『排一排』，一次一指令，直观清晰","demo":"可在指令前加一步『先看老师』获取注意力后再下达"}',
  '    ]}',
  '  ],',
  '  "teacherBehavior": ["老师教学要点1", "要点2"],',
  '  "dtt": {"totalTrials":8,"independentCorrect":5,"promptedCorrect":2,"incorrect":1,"independentRate":63,"promptLevels":{"verbal":2,"gesture":3,"physical":0}},',
  '  "hasProblemBehavior": false,',
  '  "abcEvents": [',
  '    {"time":"00:54","antecedent":"老师要求把打乱的图片排序","behavior":"孩子先尝试独立摆放但顺序有误","consequence":"老师用手指点按引导，孩子调整正确","kind":"positive","comment":"提示层级恰当，给了独立尝试机会"}',
  '  ],',
  '  "timeline": [',
  '    {"time":"01:20","role":"child","tag":"专注","desc":"独立完成排序约1分钟未离座"},',
  '    {"time":"02:05","role":"teacher","tag":"正向强化","desc":"及时具体表扬并给代币"}',
  '  ],',
  '  "stats": [',
  '    {"label":"专注时长占比","value":80,"unit":"%"},',
  '    {"label":"正向反馈次数","value":3,"unit":"次"},',
  '    {"label":"指令遵从率","value":85,"unit":"%"}',
  '  ],',
  '  "highlights": ["情绪稳定、配合度高", "第二组排序独立完成更快"],',
  '  "concerns": ["主动沟通与眼神接触偏少", "正向强化频率偏低"],',
  '  "suggestions": ["建议1（结合该孩子偏弱方向，具体可执行）", "建议2"],',
  '  "nextGoals": ["下节课：在3次机会中独立完成4步排序≥2次", "回合中至少发起1次眼神接触后再给强化"],',
  '  "teacherNextSteps": ["下节课起，孩子每次正确反应后 3 秒内给具体口头表扬+代币，强化及时性优先补齐", "两组任务之间加 30 秒互动小游戏维持动机"]',
  '}',
].join('\n');

function buildUserText(child: Child | null): string {
  return [
    '【补充要求】（边界与禁忌）',
    '- 只基于视频中真实可见/可听的证据，不确定就在描述里注明「疑似/画面不清」，不要编造具体数字；',
    '  统计值(value)是基于观察的粗略估计，给整数即可（占比类 0~100）。',
    '- 语言中立、尊重，面向家长可读：不下医学诊断结论、不贴负面标签、不做预后判断。',
    '- 时间戳一律用 mm:ss；role 只能是 "child" 或 "teacher"；所有数组即使为空也要保留字段。',
    '- childRadar 必须含全部 6 个固定维度（每项含 score 与 peer，均 1~5 整数）；',
    '  teacherScores 必须含全部 5 个固定维度（每项含 score 1~5、note 总评、segments 片段数组）；',
    '  segment.type 只能是 "problem" 或 "highlight"，time 用 mm:ss；problem 必须给 demo(正确示范)。',
    '- dtt 各字段为非负整数；不是回合式教学就全填 0。independentRate 为 0~100。',
    '- abcEvents 的 kind 只能是 "problem" 或 "positive"；没有问题行为时 hasProblemBehavior=false，',
    '  abcEvents 可留 1~2 个正向回合或留空数组；每个事件都要带 mm:ss 时间戳。',
    '- 训练建议必须结合下方孩子个案；兴趣可用于设计强化物或题材。nextGoals 要具体可测（SMART）。',
    '- 若视频过短或看不清关键互动，在 summary 里如实说明局限，其余字段尽力给出。',
    '',
    `【孩子个案】${childProfile(child)}`,
  ].join('\n');
}

/* ===================== normalize ===================== */

function toMmSs(t: any): string {
  const s = String(t ?? '').trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, '0');
  // 纯秒数 → mm:ss
  const n = Number(s);
  if (Number.isFinite(n) && n >= 0) {
    const m = Math.floor(n / 60);
    const sec = Math.floor(n % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return s || '00:00';
}

function strArr(v: any): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

function clampScore(v: any): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 3;
  return Math.min(Math.max(n, 1), 5);
}

function nonNegInt(v: any): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const CHILD_DIMS = ['专注力', '指令遵从', '沟通表达', '社交互动', '情绪调节', '精细动作'];
const TEACHER_DIMS = ['指令清晰度', '强化及时性', '提示适当性', '节奏把控', '回应一致性'];

/** 按固定维度名归一评分数组：模型给了就用，缺的补默认（3 分，标注未评估） */
function normChildRadar(v: any): DimensionScore[] {
  const arr = Array.isArray(v) ? v : [];
  return CHILD_DIMS.map((name) => {
    const hit = arr.find((x: any) => String(x?.name || '').includes(name) || name.includes(String(x?.name || '')));
    return {
      name,
      score: hit ? clampScore(hit.score) : 3,
      peer: hit && hit.peer != null ? clampScore(hit.peer) : 4,
      note: hit ? String(hit.note || '').trim() : '视频中信息不足，暂按中等估计',
    };
  });
}

function normSegments(v: any): TeacherSegment[] {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map(
      (s: any): TeacherSegment => ({
        time: toMmSs(s?.time),
        type: s?.type === 'highlight' ? 'highlight' : 'problem',
        observation: String(s?.observation || '').trim(),
        demo: String(s?.demo || '').trim() || undefined,
      })
    )
    .filter((s) => s.observation)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function normTeacherScores(v: any): TeacherDimension[] {
  const arr = Array.isArray(v) ? v : [];
  return TEACHER_DIMS.map((name) => {
    const hit = arr.find((x: any) => String(x?.name || '').includes(name) || name.includes(String(x?.name || '')));
    return {
      name,
      score: hit ? clampScore(hit.score) : 3,
      note: hit ? String(hit.note || '').trim() : '',
      segments: hit ? normSegments(hit.segments) : [],
    };
  });
}

function normDtt(v: any): DttStats {
  const d = v && typeof v === 'object' ? v : {};
  const independentCorrect = nonNegInt(d.independentCorrect);
  const incorrect = nonNegInt(d.incorrect);
  const plRaw = d.promptLevels && typeof d.promptLevels === 'object' ? d.promptLevels : {};
  const promptLevels = {
    verbal: nonNegInt(plRaw.verbal),
    gesture: nonNegInt(plRaw.gesture),
    physical: nonNegInt(plRaw.physical),
  };
  const plSum = promptLevels.verbal + promptLevels.gesture + promptLevels.physical;

  // 数据自洽校正：模型常出现 promptedCorrect 与提示层级之和对不上（如 1 vs 2）。
  // 提示层级是更细的记录，以其之和为准作为「提示下正确」的回合数。
  const promptedCorrect = plSum > 0 ? plSum : nonNegInt(d.promptedCorrect);

  // 总回合 = 独立 + 提示下 + 错误（重算，忽略模型可能矛盾的 totalTrials）
  const totalTrials = independentCorrect + promptedCorrect + incorrect;

  // 独立正确率 = 独立 / 总（重算，保证与三格数字一致）
  const independentRate = totalTrials > 0 ? Math.round((independentCorrect / totalTrials) * 100) : 0;

  return {
    totalTrials,
    independentCorrect,
    promptedCorrect,
    incorrect,
    independentRate,
    promptLevels,
  };
}

function normAbc(v: any): AbcEvent[] {
  const arr = Array.isArray(v) ? v : [];
  return arr
    .map(
      (e: any): AbcEvent => ({
        time: toMmSs(e?.time),
        antecedent: String(e?.antecedent || '').trim(),
        behavior: String(e?.behavior || '').trim(),
        consequence: String(e?.consequence || '').trim(),
        kind: e?.kind === 'problem' ? 'problem' : 'positive',
        comment: String(e?.comment || '').trim() || undefined,
      })
    )
    .filter((e) => e.antecedent || e.behavior || e.consequence)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function normalizeReport(parsed: any): VideoReport {
  const timeline: TimelineSeg[] = (Array.isArray(parsed?.timeline) ? parsed.timeline : [])
    .map((r: any) => ({
      time: toMmSs(r?.time),
      role: r?.role === 'teacher' ? 'teacher' : 'child',
      tag: String(r?.tag || '').trim(),
      desc: String(r?.desc || '').trim(),
    }))
    .filter((r: TimelineSeg) => r.tag || r.desc)
    .sort((a: TimelineSeg, b: TimelineSeg) => a.time.localeCompare(b.time));

  const stats: StatItem[] = (Array.isArray(parsed?.stats) ? parsed.stats : [])
    .map((s: any) => {
      const unit = s?.unit ? String(s.unit).trim() : undefined;
      let value = Number(s?.value);
      if (!Number.isFinite(value)) value = 0;
      // 占比类截到 0~100
      if (unit === '%') value = Math.min(Math.max(Math.round(value), 0), 100);
      else value = Math.round(value);
      return { label: String(s?.label || '').trim(), value, unit };
    })
    .filter((s: StatItem) => s.label);

  return {
    summary: String(parsed?.summary || '').trim(),
    childSummary: String(parsed?.childSummary || '').trim(),
    teacherSummary: String(parsed?.teacherSummary || '').trim(),
    childRadar: normChildRadar(parsed?.childRadar),
    teacherScores: normTeacherScores(parsed?.teacherScores),
    teacherBehavior: strArr(parsed?.teacherBehavior),
    teacherNextSteps: strArr(parsed?.teacherNextSteps),
    dtt: normDtt(parsed?.dtt),
    hasProblemBehavior: Boolean(parsed?.hasProblemBehavior),
    abcEvents: normAbc(parsed?.abcEvents),
    timeline,
    stats,
    highlights: strArr(parsed?.highlights),
    concerns: strArr(parsed?.concerns),
    suggestions: strArr(parsed?.suggestions),
    nextGoals: strArr(parsed?.nextGoals),
  };
}

/** 看一段课堂视频，返回结构化报告 */
export async function analyzeVideo(
  videoUrl: string,
  child: Child | null
): Promise<VideoReport> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            // fps=1：每秒抽一帧，课堂节奏够用又省 token（Qwen3-VL 支持 video_url）
            { type: 'video_url', video_url: { url: videoUrl }, fps: 1 },
            { type: 'text', text: buildUserText(child) },
          ],
        },
      ],
      // thinking 模型直接给结论；强制 JSON
      response_format: { type: 'json_object' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data?.error?.message || data?.message || `视频分析失败 (HTTP ${res.status})`
    );
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('模型未返回内容');

  let parsed: any;
  try {
    parsed = extractJson(typeof content === 'string' ? content : JSON.stringify(content));
  } catch {
    throw new Error('模型返回的不是有效 JSON');
  }

  const report = normalizeReport(parsed);
  if (!report.summary && report.childRadar.length === 0 && report.timeline.length === 0) {
    throw new Error('模型未产出有效报告内容');
  }
  return report;
}
