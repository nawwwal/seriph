'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingSplash from '@/components/ui/LoadingSplash';
import { buttonClassName } from '@/components/ui/buttonStyles';
import SearchWorkspaceFallback from '@/components/search/SearchWorkspaceFallback';
import SearchWorkspace from '@/components/search/SearchWorkspace';
import { useAuth } from '@/lib/contexts/AuthContext';

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

  if (isLoading) {
    return (
      <Gate>
        <LoadingSplash text="Loading Seriph..." />
      </Gate>
    );
  }
  if (!user) {
    return (
      <Gate>
        <div className="max-w-lg rounded-[var(--radius)] rule p-10 text-center">
          <p className="mb-4 text-xl">Sign in to search your type library.</p>
          <Link href="/" className={buttonClassName({ size: 'mdInline' })}>
            ← Back home
          </Link>
        </div>
      </Gate>
    );
  }

  return (
    <Suspense fallback={<SearchWorkspaceFallback />}>
      <SearchWorkspace />
    </Suspense>
  );
}
