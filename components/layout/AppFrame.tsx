'use client';

import type { ReactNode } from 'react';
import NavBar from './NavBar';

export default function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden">
      <NavBar />
      {children}
    </div>
  );
}
