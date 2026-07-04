import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '~/libs/session';

// 保护主应用路由：未登录跳转 /login
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (!session) {
    // eslint-disable-next-line no-console
    console.warn('[middleware] 未登录 -> /login', {
      path: req.nextUrl.pathname,
      hasToken: !!token,
      tokenLen: token?.length,
      hasSecret: !!process.env.SESSION_SECRET,
    });
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
