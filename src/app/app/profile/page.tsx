import { redirect } from 'next/navigation';
import { getCurrentUser } from '~/libs/auth';
import { ProfilePage } from '~/components/app/ProfilePage';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <ProfilePage initialUser={user} />;
}
