import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getCurrentUser } from '~/libs/auth';
import { LoginForm } from '~/components/login/LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const user = await getCurrentUser();
  // 只有在用户直接访问 /login（无 from 参数）时才 redirect；
  // 如果是被 middleware 从 /app/xxx 踢来，说明 middleware 认为没登录，
  // 而这里 getCurrentUser 又认为已登录 —— 状态不一致，此时应展示登录表单，
  // 避免出现 middleware ↔ login redirect 死循环 (ERR_TOO_MANY_REDIRECTS)。
  if (user && !searchParams.from) redirect('/app/toolbox');
  // 帮助 dev 排查：把请求带的 cookie 列出来（只在 dev）
  if (user && searchParams.from) {
    // eslint-disable-next-line no-console
    console.warn('[login] middleware/getCurrentUser 状态不一致，展示登录表单', {
      from: searchParams.from,
      hasCookieHeader: !!headers().get('cookie'),
    });
  }

  return (
    <main className="min-h-screen bg-paper">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
