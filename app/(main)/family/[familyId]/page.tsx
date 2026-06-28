'use client';

import { useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { storePendingFonts } from '@/utils/pendingFonts';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useFamilyDetail } from '@/lib/hooks/useFamilyDetail';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import NavBar from '@/components/layout/NavBar';
import CenteredShell from '@/components/layout/CenteredShell';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import Specimen from '@/components/font/Specimen';
import TypeTester from '@/components/font/TypeTester';
import UseFontPanel from '@/components/font/UseFontPanel';
import VariableFontPlayground from '@/components/font/VariableFontPlayground';
import FamilyHeader from '@/components/font/FamilyHeader';
import FamilyStyles from '@/components/font/FamilyStyles';
import CharacterSetSection from '@/components/font/CharacterSetSection';
import FamilyFooter from '@/components/font/FamilyFooter';

export default function FamilyDetailPage() {
  const { familyId } = useParams<{ familyId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { family, isLoading, error } = useFamilyDetail(familyId);
  useRegisterFamilyFonts(family || undefined);

  const testerRef = useRef<HTMLDivElement | null>(null);
  const scrollToTester = () => testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleAddStyleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    storePendingFonts(files);
    router.push('/import');
  };

  // The first variable face with usable axes drives the playground section.
  const variableFont = useMemo(
    () => family?.fonts?.find((f) => f.isVariable && (f.variableAxes?.length ?? 0) > 0) ?? null,
    [family]
  );

  if (isLoading) return <FontDetailLoader />;
  if (!user && !authLoading) {
    return (
      <CenteredShell>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">Sign in to view this family.</p>
          <Link href="/" className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block">← Back home</Link>
        </div>
      </CenteredShell>
    );
  }
  if (error || !family) {
    return (
      <CenteredShell>
        <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
          <p className="text-xl mb-4">{error || 'Font family not found.'}</p>
          <Link href="/" className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block">← Back to Shelf</Link>
        </div>
      </CenteredShell>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <FamilyHeader family={family} onAddStyleFiles={handleAddStyleFiles} onTestInText={scrollToTester} />
        <Specimen family={family} />
        <UseFontPanel family={family} />

        {variableFont && (
          <section className="mt-6">
            <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4 mb-6">Variable</h2>
            <VariableFontPlayground font={variableFont} fontFamilyName={family.name} />
          </section>
        )}

        <FamilyStyles family={family} />

        <div ref={testerRef}>
          <TypeTester family={family} />
        </div>

        <CharacterSetSection family={family} />
        <FamilyFooter family={family} />
      </div>
    </div>
  );
}
