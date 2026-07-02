import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { LoginForm } from '~/components/login/LoginForm';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app');

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-400 px-6">
      {/* 明黄背景 + 柔和光斑点缀 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 40%)',
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
