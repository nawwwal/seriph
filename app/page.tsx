'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FontFamily } from '@/models/font.models';
import { getAllFontFamilies } from '@/lib/db/firestoreUtils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import NavBar from '@/components/layout/NavBar';
import WelcomeState from '@/components/home/WelcomeState';
import ShelfState from '@/components/home/ShelfState';
import Stat from '@/components/ui/Stat';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

const serializeFamilies = (families: any[]): FontFamily[] => {
  return families.map((family) => ({
    ...family,
    uploadDate:
      family.uploadDate instanceof Timestamp
        ? family.uploadDate.toDate().toISOString()
        : String(family.uploadDate),
    lastModified:
      family.lastModified instanceof Timestamp
        ? family.lastModified.toDate().toISOString()
        : String(family.lastModified),
  }));
};

const CACHE_KEY_ALL_FAMILIES = 'fontFamiliesCache_all';
const CACHE_EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [families, setFamilies] = useState<FontFamily[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shelfMode, setShelfMode] = useState<'spines' | 'covers'>('covers');

  const loadFamilies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try loading from cache
      const cacheKey = user?.uid ? `${CACHE_KEY_ALL_FAMILIES}_${user.uid}` : CACHE_KEY_ALL_FAMILIES;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_EXPIRATION_MS && data.length > 0) {
          const serializedCache = serializeFamilies(data);
          setFamilies(serializedCache);
          setIsLoading(false);
          return;
        }
      }

      // Fetch from Firestore
      const { families: newFamiliesRaw } = await getAllFontFamilies(user?.uid);
      const serializedNewFamilies = serializeFamilies(newFamiliesRaw);

      setFamilies(serializedNewFamilies);

      if (serializedNewFamilies.length > 0) {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ timestamp: Date.now(), data: serializedNewFamilies })
        );
      }
    } catch (err) {
      console.error('Error fetching font families:', err);
      setError("Sorry, we couldn't load the font families. Please try refreshing the page.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  const handleFilesSelected = (files: File[]) => {
    // Navigate to import page with files
    router.push('/import');
  };

  const handleAddFonts = () => {
    router.push('/import');
  };

  const handleExport = () => {
    const csv =
      'Family,Style,Weight,Class\n' +
      families
        .flatMap((family) =>
          family.fonts.map(
            (font) =>
              `"${family.name}","${font.subfamily}",${font.weight || 400},"${family.classification}"`
          )
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'type-shelf.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="Loading Seriph..." size="large" />
        </div>
      </div>
    );
  }

  if (error && families.length === 0) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg bg-[var(--surface)]">
            <p className="text-xl text-[var(--ink)]">{error}</p>
            <button
              onClick={() => loadFamilies()}
              className="mt-4 px-6 py-2 rule rounded-[var(--radius)] btn-ink uppercase font-bold"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalStyles = families.reduce((sum, family) => sum + family.fonts.length, 0);
  const recentFamily = families.length > 0 ? families[0].name : '—';
  const isEmpty = families.length === 0;

  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <div className="flex-1 w-full h-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
              Seriph
            </h1>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <button
                onClick={handleAddFonts}
                className={`uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base ${
                  isEmpty ? 'pulse-animation' : ''
                }`}
              >
                Add Fonts <span className="caret"></span>
              </button>
              {!isEmpty && (
                <button className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink">
                  Regenerate Covers
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
            Upload font files—families are grouped automatically. Each family earns a custom cover
            reflecting its traits.
          </p>
        </header>

        {!isEmpty && (
          <section className="mt-4 sm:mt-6 md:mt-8 rule-t rule-b">
            <div className="grid grid-cols-2 sm:grid-cols-4">
              <Stat label="Families" value={families.length} />
              <Stat label="Styles" value={totalStyles} />
              <Stat label="Recently Added" value={recentFamily} />
              <div className="p-3 sm:p-4">
                <div className="uppercase text-xs sm:text-sm font-bold opacity-80">Shelf Mode</div>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setShelfMode('spines')}
                    className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] ${
                      shelfMode === 'spines' ? 'ink-bg' : 'btn-ink'
                    }`}
                  >
                    Spines
                  </button>
                  <button
                    onClick={() => setShelfMode('covers')}
                    className={`uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] ${
                      shelfMode === 'covers' ? 'ink-bg' : 'btn-ink'
                    }`}
                  >
                    Covers
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {isEmpty ? (
          <WelcomeState onFilesSelected={handleFilesSelected} />
        ) : (
          <ShelfState
            families={families}
            shelfMode={shelfMode}
            onShelfModeChange={setShelfMode}
            onAddFonts={handleAddFonts}
          />
        )}

        <footer className="mt-8 sm:mt-10 md:mt-12 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">
                A no-fuss library to browse, test, and tidy your type. One color, many voices.
              </p>
            </div>
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">Tips</div>
              <ul className="mt-2 list-disc pl-5 leading-tight">
                <li>Upload all styles for better grouping.</li>
                <li>Rename files to include weight/style.</li>
              </ul>
            </div>
            <div>
              <div className="uppercase font-bold">Export</div>
              <button
                onClick={handleExport}
                disabled={isEmpty}
                className={`mt-2 uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm ${
                  isEmpty ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Download Catalog CSV
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
