import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { UserProvider } from '~/context/user-context';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return <UserProvider user={user}>{children}</UserProvider>;
}
