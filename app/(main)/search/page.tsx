'use client';

import { Suspense, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import CenteredShell from '@/components/layout/CenteredShell';
import LoadingSplash from '@/components/ui/LoadingSplash';
import { buttonClassName } from '@/components/ui/buttonStyles';
import SearchWorkspaceFallback from '@/components/search/SearchWorkspaceFallback';
import SearchWorkspace from '@/components/search/SearchWorkspace';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSeriphWebMcp } from '@/lib/hooks/useSeriphWebMcp';

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-8">
        {children}
      </div>
    </AppShell>
  );
}

export default function SearchPage() {
  const { user, isLoading } = useAuth();
  const getIdToken = useCallback(() => user!.getIdToken(), [user]);
  useSeriphWebMcp(user ? getIdToken : undefined);

  if (isLoading) {
    return (
      <Gate>
        <LoadingSplash text="Loading Seriph..." />
      </Gate>
    );
  }
  if (!user) {
    return (
      <CenteredShell>
        <div className="max-w-lg rounded-[var(--radius)] rule p-10 text-center">
          <p className="mb-4 text-xl">Sign in to search your type library.</p>
          <Link href="/login" className={buttonClassName({ size: 'mdInline' })}>
            Sign in
          </Link>
        </div>
      </CenteredShell>
    );
  }

  return (
    <Suspense fallback={<SearchWorkspaceFallback />}>
      <SearchWorkspace />
    </Suspense>
  );
}
