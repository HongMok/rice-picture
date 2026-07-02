'use client';

import { jsPDF } from 'jspdf';
import type { ReaderPage } from '~/components/app/BookReader';

// 暖色调（与界面一致）
const CREAM: [number, number, number] = [252, 251, 248];
const CLAY: [number, number, number] = [224, 138, 91];
const INK: [number, number, number] = [43, 38, 34];
const MUTED: [number, number, number] = [138, 127, 116];
const LINE: [number, number, number] = [236, 231, 223];

/** 通过同源代理把图片取成 dataURL（jsPDF 需要 base64） */
async function fetchDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imgSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve({ w: 4, h: 3 });
    im.src = dataUrl;
  });
}

/**
 * 向服务端申请中文字体子集（仅含用到的字），注册进 jsPDF。
 * 返回可用于 setFont 的字体名；失败返回 null（回退 helvetica）。
 */
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

/**
 * 生成精美绘本 PDF（A4 横版）：
 * - 封面页：标题居中 + 装饰
 * - 每页：大图居中（保持比例）+ 图下方故事文字 + 页码
 */
export async function exportBookPdf(title: string, pages: ReaderPage[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 297
  const H = doc.internal.pageSize.getHeight(); // 210

  const SUBTITLE = '米图 特需儿童康复绘本';
  // 注册中文字体子集（含标题+副标题+所有页文字）
  const allText = title + SUBTITLE + pages.map((p) => p.text || '').join('');
  const cn = await registerChineseFont(doc, allText);
  const useFont = (weight: 'bold' | 'normal' = 'normal') => {
    if (cn) doc.setFont(cn, 'normal');
    else doc.setFont('helvetica', weight);
  };

  // ---------- 封面 ----------
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, W, H, 'F');
  // 外描边框
  doc.setDrawColor(...CLAY);
  doc.setLineWidth(1.2);
  doc.roundedRect(12, 12, W - 24, H - 24, 6, 6, 'S');
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.roundedRect(16, 16, W - 32, H - 32, 5, 5, 'S');

  // 标题
  doc.setTextColor(...INK);
  useFont('bold');
  doc.setFontSize(32);
  const titleLines = doc.splitTextToSize(title || '我的绘本', W - 80);
  doc.text(titleLines, W / 2, H / 2 - 6, { align: 'center' });

  // 副标题
  useFont('normal');
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text(SUBTITLE, W / 2, H / 2 + 14, { align: 'center' });

  // 装饰点
  doc.setFillColor(...CLAY);
  doc.circle(W / 2 - 10, H / 2 + 24, 1.6, 'F');
  doc.circle(W / 2, H / 2 + 24, 1.6, 'F');
  doc.circle(W / 2 + 10, H / 2 + 24, 1.6, 'F');

  // ---------- 内页 ----------
  const usable = pages.filter((p) => p.imageUrl);
  for (let i = 0; i < usable.length; i++) {
    const p = usable[i];
    doc.addPage();
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, W, H, 'F');

    // 文字区高度
    const textReserve = 40;
    const margin = 16;
    const areaW = W - margin * 2;
    const areaH = H - margin - textReserve;

    const dataUrl = await fetchDataUrl(p.imageUrl!);
    if (dataUrl) {
      const { w, h } = await imgSize(dataUrl);
      const ratio = w / h;
      let drawW = areaW;
      let drawH = drawW / ratio;
      if (drawH > areaH) {
        drawH = areaH;
        drawW = drawH * ratio;
      }
      const x = (W - drawW) / 2;
      const y = margin + (areaH - drawH) / 2;

      // 图片圆角白底卡 + 细边
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.5);
      doc.roundedRect(x - 2, y - 2, drawW + 4, drawH + 4, 3, 3, 'FD');
      const fmt = dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(dataUrl, fmt, x, y, drawW, drawH, undefined, 'FAST');
    }

    // 故事文字
    if (p.text) {
      doc.setTextColor(...INK);
      useFont('normal');
      doc.setFontSize(14);
      const lines = doc.splitTextToSize(p.text, W - 60);
      doc.text(lines, W / 2, H - textReserve + 14, { align: 'center' });
    }

    // 页码
    useFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`${i + 1} / ${usable.length}`, W - margin, H - 8, {
      align: 'right',
    });
  }

  const safe = (title || 'book').replace(/[\\/:*?"<>|]/g, '').slice(0, 40);
  doc.save(`${safe}.pdf`);
}
