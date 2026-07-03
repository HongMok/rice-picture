'use client';

import { jsPDF } from 'jspdf';
import type { VideoReport } from '~/data/video-types';

// 暖色调（与界面 / book-pdf 一致）
const CREAM: [number, number, number] = [252, 251, 248];
const CLAY: [number, number, number] = [224, 138, 91];
const SAGE: [number, number, number] = [122, 148, 122];
const INK: [number, number, number] = [43, 38, 34];
const MUTED: [number, number, number] = [138, 127, 116];
const LINE: [number, number, number] = [236, 231, 223];

/** 向服务端申请中文字体子集，注册进 jsPDF（同 book-pdf.ts） */
async function registerChineseFont(
  doc: jsPDF,
  text: string
): Promise<string | null> {
  try {
    const res = await fetch('/api/font-subset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    const { font } = await res.json();
    if (!font) return null;
    doc.addFileToVFS('NotoSansSC.ttf', font);
    doc.addFont('NotoSansSC.ttf', 'NotoSC', 'normal');
    return 'NotoSC';
  } catch {
    return null;
  }
}

/** 生成家长版课堂分析报告 PDF（A4 竖版，自动分页） */
export async function exportReportPdf(title: string, report: VideoReport) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 210
  const H = doc.internal.pageSize.getHeight(); // 297
  const M = 18; // 页边距
  const CW = W - M * 2; // 内容宽

  const SUBTITLE = '小禾AI · 课堂视频分析报告';
  // 收集全部文本注册字体子集：直接把整个 report 序列化，确保所有字段的字都被覆盖
  const LABELS =
    '整体概述关键指标孩子能力评估行为表现老师教学评分回合式统计DTT关键片段时间轴' +
    '进步亮点需关注信号训练建议下节课目标独立正确提示下错误无反应回合总数独立正确率' +
    '提示层级分布口语手势肢体老师孩子亮点可改进本报告由AI辅助生成仅供教研与家庭训练参考' +
    'ABC行为分析前因后果正向回合问题行为点评辅助阶梯帮助越多越不独立本节课未观察到明显配合任务全程' +
    '同龄典型对比能力发展趋势独立完成情况待改进亮点问题表现正确示范进阶示范总评本维度无特别记录' +
    '下一步建议给老师' +
    '专注力指令遵从沟通表达社交互动情绪调节精细动作指令清晰度强化及时性提示适当性节奏把控回应一致性';
  const allText = [title, SUBTITLE, LABELS, JSON.stringify(report)].join('');
  const cn = await registerChineseFont(doc, allText);
  const font = (weight: 'bold' | 'normal' = 'normal') =>
    cn ? doc.setFont(cn, 'normal') : doc.setFont('helvetica', weight);

  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, 'F');

  let y = M;

  const ensure = (need: number) => {
    if (y + need > H - M) {
      doc.addPage();
      doc.setFillColor(...CREAM);
      doc.rect(0, 0, W, H, 'F');
      y = M;
    }
  };

  // ---------- 页眉 ----------
  doc.setFillColor(...CLAY);
  doc.roundedRect(M, y, 3, 9, 1, 1, 'F');
  font('bold');
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text(title || '课堂视频分析', M + 6, y + 7);
  y += 12;
  font('normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(SUBTITLE, M + 6, y);
  y += 8;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(M, y, W - M, y);
  y += 8;

  // ---------- 小标题 ----------
  const heading = (t: string, color: [number, number, number] = CLAY) => {
    ensure(12);
    doc.setFillColor(...color);
    doc.circle(M + 1.4, y - 1.2, 1.4, 'F');
    font('bold');
    doc.setFontSize(12.5);
    doc.setTextColor(...INK);
    doc.text(t, M + 5, y);
    y += 6;
  };

  // ---------- 段落 ----------
  const paragraph = (t: string) => {
    if (!t) return;
    font('normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const lines = doc.splitTextToSize(t, CW);
    for (const line of lines) {
      ensure(6);
      doc.text(line, M, y);
      y += 5.4;
    }
    y += 2;
  };

  // ---------- 要点列表 ----------
  const bullets = (items: string[]) => {
    font('normal');
    doc.setFontSize(10.5);
    for (const it of items) {
      const lines = doc.splitTextToSize(it, CW - 5);
      ensure(6);
      doc.setFillColor(...CLAY);
      doc.circle(M + 1, y - 1.3, 0.9, 'F');
      doc.setTextColor(...INK);
      for (const line of lines) {
        ensure(6);
        doc.text(line, M + 5, y);
        y += 5.4;
      }
    }
    y += 2;
  };

  // 评分条：名称 + n/5 + 进度条 + 依据
  const scoreBar = (
    name: string,
    score: number,
    note: string,
    color: [number, number, number]
  ) => {
    ensure(11);
    font('normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(name, M, y);
    doc.setTextColor(...color);
    font('bold');
    doc.text(`${score}/5`, W - M, y, { align: 'right' });
    font('normal');
    y += 2.5;
    doc.setFillColor(...LINE);
    doc.roundedRect(M, y, CW, 2.5, 1.2, 1.2, 'F');
    doc.setFillColor(...color);
    const w = (Math.min(Math.max(score, 0), 5) / 5) * CW;
    if (w > 0) doc.roundedRect(M, y, w, 2.5, 1.2, 1.2, 'F');
    y += 5;
    if (note) {
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      const lines = doc.splitTextToSize(note, CW);
      for (const line of lines) {
        ensure(4.5);
        doc.text(line, M, y);
        y += 4;
      }
    }
    y += 3;
  };

  // 概述
  heading('整体概述');
  paragraph(report.summary || '（无）');

  // 关键指标
  if (report.stats.length) {
    heading('关键指标');
    font('normal');
    doc.setFontSize(10.5);
    for (const s of report.stats) {
      ensure(9);
      doc.setTextColor(...INK);
      doc.text(s.label, M, y);
      const valTxt = `${s.value}${s.unit || ''}`;
      doc.setTextColor(...CLAY);
      font('bold');
      doc.text(valTxt, W - M, y, { align: 'right' });
      font('normal');
      y += 2.5;
      if (s.unit === '%') {
        doc.setFillColor(...LINE);
        doc.roundedRect(M, y, CW, 2.5, 1.2, 1.2, 'F');
        doc.setFillColor(...CLAY);
        const w = Math.max(0, Math.min(1, s.value / 100)) * CW;
        if (w > 0) doc.roundedRect(M, y, w, 2.5, 1.2, 1.2, 'F');
      }
      y += 6;
    }
    y += 2;
  }

  // 进步亮点 / 需关注
  if (report.highlights?.length) {
    heading('进步亮点', SAGE);
    bullets(report.highlights);
  }
  if (report.concerns?.length) {
    heading('需关注信号', [200, 120, 40]);
    bullets(report.concerns);
  }

  // 学生总结
  if (report.childSummary) {
    heading('学生总结');
    paragraph(report.childSummary);
  }

  // 孩子能力评估（雷达维度以评分条呈现）
  if (report.childRadar?.length) {
    heading('孩子能力评估');
    for (const d of report.childRadar) scoreBar(d.name, d.score, d.note, CLAY);
  }

  // 回合统计 DTT
  if (report.dtt && report.dtt.totalTrials > 0) {
    const d = report.dtt;
    heading('回合式教学统计（DTT）');
    font('normal');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    ensure(6);
    doc.text(
      `回合总数 ${d.totalTrials}　独立正确 ${d.independentCorrect}　提示下正确 ${d.promptedCorrect}　错误/无反应 ${d.incorrect}`,
      M,
      y
    );
    y += 6;
    scoreBar('独立正确率', Math.round((d.independentRate / 100) * 5 * 10) / 10, `${d.independentRate}%`, SAGE);
    const pl = d.promptLevels;
    if (pl.verbal + pl.gesture + pl.physical > 0) {
      ensure(6);
      doc.setTextColor(...MUTED);
      doc.setFontSize(9.5);
      doc.text(
        `辅助阶梯（帮助越多越不独立）：独立 ${d.independentCorrect} · 口语 ${pl.verbal} · 手势 ${pl.gesture} · 肢体 ${pl.physical}`,
        M,
        y
      );
      y += 7;
    }
  }

  // ABC 行为分析
  if (report.abcEvents?.length) {
    heading('ABC 行为分析（前因→行为→后果）');
    font('normal');
    doc.setFontSize(10);
    for (const e of report.abcEvents) {
      const kindTxt = e.kind === 'problem' ? '问题行为' : '正向回合';
      ensure(8);
      doc.setTextColor(...(e.kind === 'problem' ? ([200, 120, 40] as [number, number, number]) : SAGE));
      font('bold');
      doc.text(`${e.time}  ${kindTxt}`, M, y);
      y += 5;
      font('normal');
      doc.setTextColor(...INK);
      for (const [tag, txt] of [
        ['A 前因', e.antecedent],
        ['B 行为', e.behavior],
        ['C 后果', e.consequence],
        ...(e.comment ? [['点评', e.comment]] : []),
      ] as [string, string][]) {
        const lines = doc.splitTextToSize(`${tag}：${txt}`, CW - 4);
        for (const line of lines) {
          ensure(5);
          doc.text(line, M + 4, y);
          y += 4.6;
        }
      }
      y += 2;
    }
    y += 2;
  } else if (report.hasProblemBehavior === false) {
    heading('ABC 行为分析（前因→行为→后果）');
    paragraph('本节课未观察到明显问题行为，孩子全程配合任务。');
  }

  // 老师总结
  if (report.teacherSummary) {
    heading('老师总结', SAGE);
    paragraph(report.teacherSummary);
  }

  // 老师教学评分（每维度：评分条 + 总评 + 多个片段）
  if (report.teacherScores?.length) {
    heading('老师教学评分', SAGE);
    for (const d of report.teacherScores) {
      scoreBar(d.name, d.score, d.note || '', SAGE);
      for (const s of d.segments || []) {
        const isProblem = s.type === 'problem';
        const obsTag = isProblem ? '问题表现' : '亮点表现';
        const demoTag = isProblem ? '正确示范' : '进阶示范';
        ensure(6);
        font('bold');
        doc.setFontSize(9);
        doc.setTextColor(...(isProblem ? ([200, 120, 40] as [number, number, number]) : SAGE));
        doc.text(`${s.time}  ${isProblem ? '待改进' : '亮点'}`, M + 4, y);
        y += 4.6;
        font('normal');
        doc.setTextColor(...INK);
        for (const [tag, txt] of [
          [obsTag, s.observation],
          ...(s.demo ? [[demoTag, s.demo]] : []),
        ] as [string, string][]) {
          const lines = doc.splitTextToSize(`${tag}：${txt}`, CW - 8);
          for (const line of lines) {
            ensure(4.6);
            doc.text(line, M + 8, y);
            y += 4.4;
          }
        }
        y += 1.5;
      }
      y += 2;
    }
  }

  // 老师行为
  if (report.teacherBehavior.length) {
    heading('老师教学表现', SAGE);
    bullets(report.teacherBehavior);
  }

  // 时间轴
  if (report.timeline.length) {
    heading('关键片段时间轴');
    font('normal');
    doc.setFontSize(10);
    for (const seg of report.timeline) {
      const roleTxt = seg.role === 'teacher' ? '老师' : '孩子';
      const head = `${seg.time}  ${roleTxt}·${seg.tag}`;
      const descLines = doc.splitTextToSize(seg.desc, CW - 4);
      ensure(6 + descLines.length * 5);
      // 时间/角色标签行
      doc.setTextColor(...(seg.role === 'teacher' ? SAGE : CLAY));
      font('bold');
      doc.text(head, M, y);
      y += 5;
      font('normal');
      doc.setTextColor(...INK);
      for (const line of descLines) {
        ensure(5.5);
        doc.text(line, M + 4, y);
        y += 5;
      }
      y += 1.5;
    }
    y += 2;
  }

  // 建议
  if (report.suggestions.length) {
    heading('训练建议');
    bullets(report.suggestions);
  }

  // 下节课目标
  if (report.nextGoals?.length) {
    heading('下节课训练目标', SAGE);
    bullets(report.nextGoals);
  }

  // 给老师的下一步建议（区别于上面给孩子的训练建议）
  if (report.teacherNextSteps?.length) {
    heading('下一步建议（给老师）', SAGE);
    bullets(report.teacherNextSteps);
  }

  // 页脚（每页）
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    font('normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('本报告由 AI 辅助生成，仅供教研与家庭训练参考', M, H - 8);
    doc.text(`${i} / ${pageCount}`, W - M, H - 8, { align: 'right' });
  }

  const safe = (title || 'report').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  doc.save(`${safe}.pdf`);
}
