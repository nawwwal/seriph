'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import LoadingSplash from '@/components/ui/LoadingSplash';
import { buttonClassName } from '@/components/ui/buttonStyles';
import SearchWorkspaceFallback from '@/components/search/SearchWorkspaceFallback';
import SearchWorkspace from '@/components/search/SearchWorkspace';
import { useAuth } from '@/lib/contexts/AuthContext';

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen flex-1 min-h-0 flex items-center justify-center p-8 bg-[var(--paper)]">
      {children}
    </div>
  );
}

export default function SearchPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Gate><LoadingSplash text="Loading Seriph..." /></Gate>;
  if (!user) {
    return (
      <Gate>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">Sign in to search your type library.</p>
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
