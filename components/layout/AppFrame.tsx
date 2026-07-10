'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import NavBar from './NavBar';

export default function AppFrame({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className={user ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen flex flex-col'}>
      <NavBar />
      {children}
    </div>
  );
}
