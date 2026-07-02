import { NextResponse } from 'next/server';
import { getCurrentUser } from '~/libs/auth';

export const runtime = 'nodejs';

// 代理拉取 DashScope 图片（同源返回，供前端 jsPDF / canvas 使用，规避跨域）
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });

  const url = new URL(req.url).searchParams.get('url');
  if (!url || !/^https:\/\/[\w.-]*aliyuncs\.com\//.test(url)) {
    return NextResponse.json({ error: '非法地址' }, { status: 400 });
  }

  const upstream = await fetch(url, { cache: 'no-store' });
  if (!upstream.ok) {
    return NextResponse.json({ error: '获取图片失败' }, { status: 502 });
  }
  const buf = await upstream.arrayBuffer();
  return new NextResponse(buf, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
