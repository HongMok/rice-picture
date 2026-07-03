import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { LoginForm } from '~/components/login/LoginForm';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app');

  return (
    <main className="min-h-screen bg-cream">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
