'use client';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * 高保真报告 PDF 导出：直接截图 DOM 元素 → 分页塞进 A4 PDF。
 *
 * 相比之前用 jsPDF 手绘：视觉 100% 跟 HTML 一致（雷达图、渐变、圆角、卡片、
 * badge、进度条），不用给每个组件写一遍 PDF 版布局。
 *
 * 代价：文字变栅格图（不可选可搜、文件较大 ~3-8MB）。可接受，因为报告是给家长
 * "看"的，不是数据表格。
 *
 * 用法：
 *   const container = ref.current; // 想变成 PDF 的 DOM
 *   await exportReportPdf(title, container);
 */
export async function exportReportPdf(
  title: string,
  element: HTMLElement,
  opts?: {
    /** 输出文件名（不含 .pdf） */
    filename?: string;
    /** 截图倍率，越高越清晰但文件也越大。默认 2. */
    scale?: number;
  }
) {
  const scale = opts?.scale ?? 2;
  const filename = (opts?.filename || title || 'report').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);

  // ---- 提前收集"分页避让锚点"：所有卡片块的顶部相对 element 的 y 坐标（DOM 单位）。
  // 分页切片时如果切线穿过某个卡片，就上移切线到该卡片顶部——保证块不会被切两半。
  const breakpointsCss = collectBreakpoints(element);

  // 1) 截图整个元素
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor || '#FAF7F2',
    ignoreElements: (el) => el.hasAttribute('data-pdf-hide'),
    allowTaint: false,
    logging: false,
  });

  // DOM 里收集的 y（CSS px）转成 canvas 上的 y（含 scale）
  // 注意 html2canvas 输出的 canvas 尺寸 = 元素 CSS 尺寸 × scale，所以直接乘 scale 即可。
  const breakpointsPx = breakpointsCss.map((y) => Math.round(y * scale));

  // 2) 塞进 A4 PDF，按页高切片分页
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth(); // 210mm
  const pageH = pdf.internal.pageSize.getHeight(); // 297mm
  const margin = 8;
  const contentW = pageW - margin * 2;

  const imgW = contentW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH - margin * 2) {
    const img = canvas.toDataURL('image/jpeg', 0.92);
    pdf.addImage(img, 'JPEG', margin, margin, imgW, imgH, undefined, 'FAST');
    pdf.save(`${filename}.pdf`);
    return;
  }

  const pageContentHMm = pageH - margin * 2;
  const pxPerMm = canvas.height / imgH;
  const pageSliceHPx = Math.floor(pageContentHMm * pxPerMm);

  let offsetY = 0;
  let first = true;
  while (offsetY < canvas.height) {
    let sliceHPx = Math.min(pageSliceHPx, canvas.height - offsetY);
    const tentativeEnd = offsetY + sliceHPx;

    // 若这一页还没到底部，且切线正好穿过某个卡片：把切线上移到该卡片顶部
    if (tentativeEnd < canvas.height) {
      const safeEnd = findSafeBreak(breakpointsPx, offsetY, tentativeEnd);
      if (safeEnd != null && safeEnd > offsetY) {
        sliceHPx = safeEnd - offsetY;
      }
    }

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHPx;
    const ctx = slice.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 上下文创建失败');
    ctx.drawImage(
      canvas,
      0,
      offsetY,
      canvas.width,
      sliceHPx,
      0,
      0,
      canvas.width,
      sliceHPx
    );
    const sliceHMm = sliceHPx / pxPerMm;

    if (!first) pdf.addPage();
    first = false;
    const img = slice.toDataURL('image/jpeg', 0.92);
    pdf.addImage(img, 'JPEG', margin, margin, imgW, sliceHMm, undefined, 'FAST');

    offsetY += sliceHPx;
  }

  pdf.save(`${filename}.pdf`);
}

/**
 * 收集报告 DOM 里所有"可作为分页锚点"的块的顶部 y（相对 root 的 CSS px）。
 * 选择器覆盖：
 *  - Section 容器（`rounded-section`）
 *  - 内部卡片（`rounded-card`）
 *  - 高度较大的独立 block（li、rounded-lg 卡）——保证 timeline 每条不被切
 * 只收集"跨越较大高度"的元素，避免小 badge / TimeStamp 也进候选（会导致每页只装 1 行）。
 */
function collectBreakpoints(root: HTMLElement): number[] {
  const rootRect = root.getBoundingClientRect();
  const selectors = [
    '.rounded-section',
    '.rounded-card',
    '.rounded-lg',
    'li',
  ];
  const nodes = root.querySelectorAll<HTMLElement>(selectors.join(','));
  const ys = new Set<number>();
  // 顶部（页面开头）也可以断
  ys.add(0);
  nodes.forEach((n) => {
    // 被 data-pdf-hide 隐藏的块不参与
    if (n.hasAttribute('data-pdf-hide')) return;
    let parent: HTMLElement | null = n.parentElement;
    while (parent && parent !== root) {
      if (parent.hasAttribute('data-pdf-hide')) return;
      parent = parent.parentElement;
    }
    const rect = n.getBoundingClientRect();
    // 跳过高度非常小的元素（<40px），避免出现"每一小行都是断点"
    if (rect.height < 40) return;
    const y = rect.top - rootRect.top;
    ys.add(Math.max(0, Math.round(y)));
  });
  return Array.from(ys).sort((a, b) => a - b);
}

/**
 * 给定一个切线区间 [start, tentativeEnd]，返回 <= tentativeEnd 的最大"安全断点"。
 * 也就是找 breakpoints 里最靠近 tentativeEnd 但仍 <= 它、且 > start 的那个。
 * 找不到返回 null——调用方就走硬切。
 *
 * 边界策略：如果最优断点距 tentativeEnd 太远（> 60% 页高），说明这一页几乎没啥可切，
 * 那还是硬切、宁可牺牲这一处也别让页面剩太大空白。
 */
function findSafeBreak(
  breakpoints: number[],
  start: number,
  tentativeEnd: number
): number | null {
  const pageHPx = tentativeEnd - start;
  const minAcceptable = start + pageHPx * 0.4; // 至少填 40% 页高才认为断点合适

  let best: number | null = null;
  for (const bp of breakpoints) {
    if (bp <= start) continue;
    if (bp > tentativeEnd) break;
    if (bp >= minAcceptable) best = bp;
  }
  return best;
}
