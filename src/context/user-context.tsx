'use client';

import { createContext, useContext } from 'react';
import type { CurrentUser } from '~/libs/auth';

const UserContext = createContext<CurrentUser | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser(): CurrentUser | null {
  return useContext(UserContext);
}
