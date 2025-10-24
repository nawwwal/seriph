'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FontFamily, Font as FontVariant } from '@/models/font.models';
import { getFontFamilyById } from '@/lib/db/firestoreUtils';
import { Timestamp } from 'firebase/firestore';
import NavBar from '@/components/layout/NavBar';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import StyleCard from '@/components/font/StyleCard';
import Specimen from '@/components/font/Specimen';
import TypeTester from '@/components/font/TypeTester';

const serializeFamilyData = (family: any): FontFamily | null => {
  if (!family) return null;
  return {
    ...family,
    uploadDate:
      family.uploadDate instanceof Timestamp
        ? family.uploadDate.toDate().toISOString()
        : String(family.uploadDate),
    lastModified:
      family.lastModified instanceof Timestamp
        ? family.lastModified.toDate().toISOString()
        : String(family.lastModified),
    fonts: family.fonts ? family.fonts.map((font: any) => ({ ...font })) : [],
  };
};

export default function FamilyDetailPage() {
  const routeParams = useParams<{ familyId: string }>();
  const familyId = routeParams.familyId;

  const [family, setFamily] = useState<FontFamily | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const groupedFontsBySubfamily = useMemo(() => {
    if (!family || !family.fonts) return {};
    return family.fonts.reduce((acc, font) => {
      const key = font.subfamily || 'Unknown Subfamily';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(font);
      return acc;
    }, {} as { [subfamilyName: string]: FontVariant[] });
  }, [family]);

  const filteredFonts = useMemo(() => {
    if (!family) return {};
    if (activeFilter === 'All') return groupedFontsBySubfamily;
    
    return Object.entries(groupedFontsBySubfamily).reduce((acc, [key, variants]) => {
      const matchesFilter = 
        (activeFilter === 'Regular' && key.toLowerCase().includes('regular')) ||
        (activeFilter === 'Bold' && key.toLowerCase().includes('bold')) ||
        (activeFilter === 'Italic' && key.toLowerCase().includes('italic'));
      
      if (matchesFilter) {
        acc[key] = variants;
      }
      return acc;
    }, {} as { [subfamilyName: string]: FontVariant[] });
  }, [groupedFontsBySubfamily, activeFilter]);

  useEffect(() => {
    if (!familyId) {
      setError('Font family ID is not available in the route.');
      setIsLoading(false);
      return;
    }

    const fetchFamilyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rawFamilyData = await getFontFamilyById(familyId);
        if (rawFamilyData) {
          const processedFamily = serializeFamilyData(rawFamilyData);
          setFamily(processedFamily as FontFamily);
        } else {
          setError('Font family not found. It might have been moved or deleted.');
        }
      } catch (err) {
        console.error(`Error fetching font family ${familyId}:`, err);
        setError('Could not load the font family details. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchFamilyData();
  }, [familyId]);

  if (isLoading) {
    return <FontDetailLoader />;
  }

  if (error || !family) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
            <p className="text-xl mb-4">{error || 'Font family not found.'}</p>
            <Link href="/" className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block">
              ← Back to Shelf
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(40px,6vw,80px)] leading-[0.9]">
                {family.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink">
                Add Style <span className="caret"></span>
              </button>
              <button className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink">
                Test in Text
              </button>
            </div>
          </div>
          {family.description && (
            <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
              {family.description}
            </p>
          )}
        </header>

        <Specimen family={family} />

        <section className="mt-6">
          <div className="flex justify-between items-center rule-b pb-4">
            <h2 className="uppercase font-black text-2xl sm:text-3xl">Styles</h2>
            <div className="flex gap-2">
              {['All', 'Regular', 'Bold', 'Italic'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] ${
                    activeFilter === filter ? 'ink-bg' : 'btn-ink'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(filteredFonts).map(([subfamilyName, variants]) => (
              <StyleCard
                key={subfamilyName}
                subfamilyName={subfamilyName}
                variants={variants}
                familyName={family.name}
              />
            ))}
          </div>
        </section>

        <TypeTester family={family} />

        <section className="mt-10">
          <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Character Set</h2>
          <div className="mt-6 rule p-6 rounded-[var(--radius)] overflow-x-auto">
            <div
              className="text-xl tracking-wide"
              style={{ fontFamily: family.name }}
            >
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Uppercase</div>
                A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
              </div>
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Lowercase</div>
                a b c d e f g h i j k l m n o p q r s t u v w x y z
              </div>
              <div className="mb-4">
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Numbers</div>
                0 1 2 3 4 5 6 7 8 9
              </div>
              <div>
                <div className="uppercase text-xs font-bold opacity-80 mb-2">Punctuation</div>
                {`! @ # $ % ^ & * ( ) - _ = + [ ] { } ; : ' " , . < > / ? \\`}
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">
                {family.description || 'A no-fuss library to browse, test, and tidy your type. One color, many voices.'}
              </p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Details</div>
              <div className="mt-2 text-sm space-y-1">
                {family.uploadDate && (
                  <p>
                    <span className="font-bold">Uploaded:</span>{' '}
                    {new Date(family.uploadDate).toLocaleDateString()}
                  </p>
                )}
                {family.fonts[0]?.metadata?.version && (
                  <p>
                    <span className="font-bold">Version:</span> {family.fonts[0].metadata.version}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="uppercase font-bold">Actions</div>
              <div className="mt-2 flex gap-2">
                <button className="uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm">
                  Download
                </button>
                <button className="uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm">
                  Share
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
