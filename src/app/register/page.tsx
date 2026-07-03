import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { RegisterForm } from '~/components/login/RegisterForm';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/app/toolbox');

  return (
    <main className="min-h-screen bg-paper">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
