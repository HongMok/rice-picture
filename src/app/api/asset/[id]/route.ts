import { NextResponse } from 'next/server';
import { getAssetData } from '~/libs/assets';

export const runtime = 'nodejs';

// 读取数据库兜底存储的图片（base64 data URL → 图片字节）
// 公开可读：<img> 直接引用，无需 cookie。图片本身无敏感信息。
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const row = await getAssetData(id);
  if (!row?.data) {
    return NextResponse.json({ error: '图片不存在' }, { status: 404 });
  }

  // data URL 形如 data:image/png;base64,xxxx
  const comma = row.data.indexOf(',');
  const header = comma >= 0 ? row.data.slice(0, comma) : '';
  const b64 = comma >= 0 ? row.data.slice(comma + 1) : '';
  const ctMatch = header.match(/^data:([^;]+);base64$/);
  if (!ctMatch || !b64) {
    return NextResponse.json({ error: '图片格式错误' }, { status: 500 });
  }
  const contentType = ctMatch[1];
  const buf = Buffer.from(b64, 'base64');

  return new NextResponse(buf, {
    headers: {
      'Content-Type': contentType,
      // 永久缓存：素材内容不会变
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
