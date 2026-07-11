'use client';

import { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { storePendingFonts } from '@/utils/pendingFonts';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFamilyDetail } from '@/lib/hooks/useFamilyDetail';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import FamilyDetailContent from '@/components/font/FamilyDetailContent';
import FamilyHeaderActions from '@/components/font/FamilyHeaderActions';
import FamilyStatusStats from '@/components/font/FamilyStatusStats';

function ShellMessage({ children }: { children: React.ReactNode }) {
  return (
    <AppShell density="compact">
      <div className="flex h-full min-h-0 items-center justify-center overflow-auto p-8">
        <div className="max-w-lg rounded-[var(--radius)] rule p-10 text-center">
          {children}
        </div>
      </div>
    </AppShell>
  );
}

export default function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { kind, family, isLoading, error, isPreview } = useFamilyDetail(familyId);
  useRegisterFamilyFonts(family || undefined);

  const testerRef = useRef<HTMLDivElement | null>(null);
  const scrollToTester = () =>
    testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleAddStyleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!user || files.length === 0) return;
    storePendingFonts(files, user.uid);
    router.push('/import');
  };

  if (isLoading) {
    return (
      <AppShell density="compact">
        <FontDetailLoader />
      </AppShell>
    );
  }
  if (!user && !authLoading) {
    return (
      <ShellMessage>
        <p className="mb-4 text-xl">Sign in to view this family.</p>
        <Link href="/" scroll={false} className={buttonClassName({ size: 'mdInline' })}>
          ← Back home
        </Link>
      </ShellMessage>
    );
  }
  if (kind === 'not-found' || kind === 'load-error' || !family) {
    return (
      <ShellMessage>
        <p className="mb-4 text-xl">{error || 'Font family not found.'}</p>
        <Link href="/" scroll={false} className={buttonClassName({ size: 'mdInline' })}>
          ← Back to Shelf
        </Link>
      </ShellMessage>
    );
  }

  return (
    <AppShell
      density="compact"
      headerActions={
        <FamilyHeaderActions
          onAddStyleFiles={handleAddStyleFiles}
          onTestInText={scrollToTester}
        />
      }
      statusStrip={<FamilyStatusStats family={family} />}
    >
      <FamilyDetailContent
        family={family}
        isPreview={isPreview}
        testerRef={testerRef}
      />
    </AppShell>
  );
}
