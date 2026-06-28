'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { useFamilies } from '@/lib/hooks/useFamilies';
import NavBar from '@/components/layout/NavBar';
import CenteredShell from '@/components/layout/CenteredShell';
import WelcomeState from '@/components/home/WelcomeState';
import ShelfState from '@/components/home/ShelfState';
import ShelfStats from '@/components/home/ShelfStats';
import HomeHeader from '@/components/home/HomeHeader';
import HomeFooter from '@/components/home/HomeFooter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import BatchHUD from '@/components/font/BatchHUD';
import LandingPage from '@/components/home/LandingPage';
import { storePendingFonts } from '@/utils/pendingFonts';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { ingests: pendingIngests } = useUploads();
  const { families, isLoading, error, reload } = useFamilies();
  const [shelfMode, setShelfMode] = useState<'spines' | 'covers'>('covers');
  const [coverSeed, setCoverSeed] = useState(0);

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      storePendingFonts(files);
      router.push('/import');
    },
    [router]
  );
  const handleAddFonts = () => router.push('/import');

  if (authLoading) return <CenteredShell><LoadingSpinner text="Loading Seriph…" size="large" /></CenteredShell>;
  if (!user) return <LandingPage />; // logged out: never the catalogue
  if (isLoading) return <CenteredShell><LoadingSpinner text="Loading Seriph…" size="large" /></CenteredShell>;

  if (error && families.length === 0 && pendingIngests.length === 0) {
    return (
      <CenteredShell>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg bg-[var(--surface)]">
          <p className="text-xl text-[var(--ink)]">{error}</p>
          <button onClick={reload} className="mt-4 px-6 py-2 rule rounded-[var(--radius)] btn-ink uppercase font-bold">
            Try Again
          </button>
        </div>
      </CenteredShell>
    );
  }

  const isEmpty = families.length === 0 && pendingIngests.length === 0;

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <HomeHeader isEmpty={isEmpty} onAddFonts={handleAddFonts} onRegenerateCovers={() => setCoverSeed((s) => s + 1)} />

        {!isEmpty && (
          <ShelfStats families={families} pendingCount={pendingIngests.length} shelfMode={shelfMode} setShelfMode={setShelfMode} />
        )}

        {/* ARIA live region for status announcements */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcements" />

        {isEmpty ? (
          <WelcomeState onFilesSelected={handleFilesSelected} />
        ) : (
          <>
            <ShelfState
              families={families}
              pendingIngests={pendingIngests}
              shelfMode={shelfMode}
              onAddFonts={handleAddFonts}
              coverSeed={coverSeed}
            />
            {pendingIngests.length > 0 && <BatchHUD />}
          </>
        )}

        <HomeFooter families={families} />
      </div>
    </div>
  );
}
