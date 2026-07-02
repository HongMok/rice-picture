import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import { getCurrentUser } from '~/libs/auth';

export const runtime = 'nodejs';

let fontCache: Buffer | null = null;
function sourceFont(): Buffer {
  if (!fontCache) {
    fontCache = readFileSync(join(process.cwd(), 'assets', 'NotoSansSC.woff2'));
  }
  return fontCache;
}

// 根据传入文本，把中文字体子集化成极小的 TTF（base64），供前端 jsPDF 内嵌
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  let text = '';
  try {
    text = (await req.json())?.text || '';
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  // 附带常用字符，保证标点/数字/副标题可用
  const extra =
    '米图·特需儿童康复绘本我的页第共012345678910。，、！？：；“”‘’（）—…《》';
  const chars = Array.from(new Set((text + extra).split(''))).join('');

  try {
    const sub = await subsetFont(sourceFont(), chars, {
      targetFormat: 'truetype',
    });
    return NextResponse.json({ font: sub.toString('base64') });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || '字体子集化失败' },
      { status: 500 }
    );
  }
}
