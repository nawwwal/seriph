'use client';

import { useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { storePendingFonts } from '@/utils/pendingFonts';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFamilyDetail } from '@/lib/hooks/useFamilyDetail';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import NavBar from '@/components/layout/NavBar';
import CenteredShell from '@/components/layout/CenteredShell';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import FamilyDetailContent from '@/components/font/FamilyDetailContent';

export default function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { kind, family, isLoading, error, isPreview } = useFamilyDetail(familyId);
  useRegisterFamilyFonts(family || undefined);

  const testerRef = useRef<HTMLDivElement | null>(null);
  const scrollToTester = () => testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleAddStyleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!user || files.length === 0) return;
    storePendingFonts(files, user.uid);
    router.push('/import');
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <FontDetailLoader />
      </div>
    );
  }
  if (!user && !authLoading) {
    return (
      <CenteredShell>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">Sign in to view this family.</p>
          <Link href="/" className={buttonClassName({ size: 'mdInline' })}>← Back home</Link>
        </div>
      </CenteredShell>
    );
  }
  if (kind === 'not-found' || kind === 'load-error' || !family) {
    return (
      <CenteredShell>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">{error || 'Font family not found.'}</p>
          <Link href="/" className={buttonClassName({ size: 'mdInline' })}>← Back to Shelf</Link>
        </div>
      </CenteredShell>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <FamilyDetailContent
        family={family}
        isPreview={isPreview}
        testerRef={testerRef}
        onAddStyleFiles={handleAddStyleFiles}
        onTestInText={scrollToTester}
      />
    </div>
  );
}
