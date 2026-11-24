'use client';

import { useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useUploads } from '@/lib/contexts/UploadContext';
import { filesFromInput } from '@/utils/walkDirectoryEntries';
import { useFamilyDetail } from '@/lib/hooks/useFamilyDetail';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import FamilyDetailContent from '@/components/font/FamilyDetailContent';
import { FamilyDetailProvider, useFamilyDetailContext } from '@/components/font/FamilyDetailContext';
import FamilyHeaderActions from '@/components/font/FamilyHeaderActions';
import FamilyStatusStats from '@/components/font/FamilyStatusStats';
import { useSeriphWebMcp } from '@/lib/hooks/useSeriphWebMcp';

function ShellMessage({ children }: { children: React.ReactNode }) {
  return (
    <AppShell density="compact">
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-8">
        <div className="max-w-lg rounded-[var(--radius)] rule p-10 text-center">{children}</div>
      </div>
    </AppShell>
  );
}

function LoadedFamilyDetailShell() {
  const { state, actions, meta } = useFamilyDetailContext();
  return (
    <AppShell
      density="compact"
      headerActions={
        <FamilyHeaderActions
          onAddStyleFiles={actions.addStyleFiles}
          onTestInText={actions.focusPlayground}
        />
      }
      statusStrip={<FamilyStatusStats family={state.family} />}
    >
      <FamilyDetailContent
        family={state.family}
        isPreview={state.isPreview}
        testerRef={meta.testerRef}
      />
    </AppShell>
  );
}

export default function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { actions: uploadActions } = useUploads();
  const { kind, family, isLoading, error, isPreview, reload } = useFamilyDetail(familyId);
  useRegisterFamilyFonts(family || undefined);
  const getIdToken = useCallback(() => user!.getIdToken(), [user]);
  useSeriphWebMcp(user ? getIdToken : undefined, familyId);

  useEffect(() => {
    if (!user?.uid) return;
    return uploadActions.onCompleted(() => {
      clearFamilyDetailNegativeCacheForUser(user.uid);
      clearFamilyCacheForUser(user.uid);
      reload();
    });
  }, [uploadActions, user?.uid, reload]);

  const handleAddStyleFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!user || files.length === 0) return;
    void uploadActions.upload(filesFromInput(files));
  }, [uploadActions, user]);

  if (isLoading) return <AppShell density="compact"><FontDetailLoader /></AppShell>;
  if (!user && !authLoading) {
    return (
      <ShellMessage>
        <p className="mb-4 text-xl">Sign in to view this family.</p>
        <Link href="/login" className={buttonClassName({ size: 'mdInline' })}>Sign in</Link>
      </ShellMessage>
    );
  }
  if (kind === 'not-found' || kind === 'load-error' || !family) {
    return (
      <ShellMessage>
        <p className="mb-4 text-xl">{error || 'Font family not found.'}</p>
        <Link href="/" scroll={false} className={buttonClassName({ size: 'mdInline' })}>← Back to Shelf</Link>
      </ShellMessage>
    );
  }

  return (
    <FamilyDetailProvider
      family={family}
      isPreview={isPreview}
      error={error}
      onRetryLoad={reload}
      onAddStyleFiles={handleAddStyleFiles}
    >
      <LoadedFamilyDetailShell />
    </FamilyDetailProvider>
  );
}
