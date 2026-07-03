import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { UserProvider } from '~/context/user-context';
import { GlobalSidebar } from '~/components/app/GlobalSidebar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <UserProvider user={user}>
      <div className="flex h-screen overflow-hidden bg-paper">
        <GlobalSidebar />
        <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </UserProvider>
  );
}
