'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { storePendingFonts } from '@/utils/pendingFonts';
import { FontFamily, Font as FontVariant } from '@/models/font.models';
import { getFontFamilyById } from '@/lib/db/firestoreUtils';
import { useAuth } from '@/lib/contexts/AuthContext';
import { Timestamp } from 'firebase/firestore';
import NavBar from '@/components/layout/NavBar';
import FontDetailLoader from '@/components/ui/FontDetailLoader';
import StyleCard from '@/components/font/StyleCard';
import Specimen from '@/components/font/Specimen';
import TypeTester from '@/components/font/TypeTester';
import UseFontPanel from '@/components/font/UseFontPanel';
import VariableFontPlayground from '@/components/font/VariableFontPlayground';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';

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
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [family, setFamily] = useState<FontFamily | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copied' | 'Failed'>('Share');
  const [downloadLabel, setDownloadLabel] = useState<'Download' | 'Preparing…' | 'Failed'>('Download');

  const testerRef = useRef<HTMLDivElement | null>(null);
  const addStyleInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToTester = () => {
    testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddStyleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    storePendingFonts(files);
    router.push('/import');
  };

  const handleShare = async () => {
    try {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      await navigator.clipboard.writeText(url);
      setShareLabel('Copied');
      setTimeout(() => setShareLabel('Share'), 1500);
    } catch {
      setShareLabel('Failed');
      setTimeout(() => setShareLabel('Share'), 1500);
    }
  };

  const handleDownload = async () => {
    if (!family) return;
    setDownloadLabel('Preparing…');
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      let added = 0;
      await Promise.all(
        (family.fonts || []).map(async (font) => {
          const url =
            ((font.metadata as any)?.downloadUrl as string | undefined) ||
            ((font.metadata as any)?.cdnUrl as string | undefined);
          if (!url) return;
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const blob = await res.blob();
            const ext = (font.format || 'woff2').toLowerCase();
            const safe = (font.filename || `${font.subfamily || 'style'}.${ext}`).replace(/[/\\]/g, '_');
            zip.file(safe, blob);
            added += 1;
          } catch {
            /* skip individual failures */
          }
        })
      );
      if (added === 0) {
        setDownloadLabel('Failed');
        setTimeout(() => setDownloadLabel('Download'), 1500);
        return;
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const href = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = href;
      a.download = `${family.name.replace(/[/\\]/g, '_')}.zip`;
      a.click();
      URL.revokeObjectURL(href);
      setDownloadLabel('Download');
    } catch {
      setDownloadLabel('Failed');
      setTimeout(() => setDownloadLabel('Download'), 1500);
    }
  };

  // Register fonts for this family when available
  useRegisterFamilyFonts(family || undefined);

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

  // The first variable face with usable axes drives the playground section.
  const variableFont = useMemo(() => {
    if (!family?.fonts) return null;
    return (
      family.fonts.find((f) => f.isVariable && (f.variableAxes?.length ?? 0) > 0) ?? null
    );
  }, [family]);

  // Parse Unicode ranges and generate character set
  const characterSet = useMemo(() => {
    if (!family || !family.fonts || family.fonts.length === 0) return new Set<number>();

    const codePoints = new Set<number>();
    
    // Collect all character set coverage from all fonts
    family.fonts.forEach(font => {
      const coverage = font.metadata?.characterSetCoverage;
      if (coverage && Array.isArray(coverage)) {
        coverage.forEach(range => {
          // Parse ranges like "U+0020-U+007F" or single "U+00A0"
          const match = range.match(/U\+([0-9A-F]+)(?:-U\+([0-9A-F]+))?/i);
          if (match) {
            const start = parseInt(match[1], 16);
            const end = match[2] ? parseInt(match[2], 16) : start;
            
            for (let code = start; code <= end; code++) {
              // Only include printable characters (skip control characters)
              if (code >= 0x20 || code === 0x09) { // Include space and tab
                codePoints.add(code);
              }
            }
          }
        });
      }
    });

    return codePoints;
  }, [family]);

  // Group characters by category for display
  const groupedCharacters = useMemo(() => {
    const groups: {
      uppercase: string[];
      lowercase: string[];
      numbers: string[];
      punctuation: string[];
      symbols: string[];
      other: string[];
    } = {
      uppercase: [],
      lowercase: [],
      numbers: [],
      punctuation: [],
      symbols: [],
      other: [],
    };

    Array.from(characterSet).sort((a, b) => a - b).forEach(codePoint => {
      try {
        const char = String.fromCodePoint(codePoint);
        
        // Categorize characters - check in order of specificity
        // Check for letters (including accented) by testing case conversion
        // A letter has different uppercase and lowercase forms
        const isUppercase = char === char.toUpperCase() && char !== char.toLowerCase();
        const isLowercase = char === char.toLowerCase() && char !== char.toUpperCase();
        
        if (isUppercase || /[A-Z]/.test(char)) {
          groups.uppercase.push(char);
        } else if (isLowercase || /[a-z]/.test(char)) {
          groups.lowercase.push(char);
        } else if (/[0-9]/.test(char)) {
          groups.numbers.push(char);
        } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?`~]/.test(char)) {
          groups.punctuation.push(char);
        } else if (char.trim() !== '' && /[^\w\s]/.test(char)) {
          groups.symbols.push(char);
        } else {
          // Everything else (spaces, other Unicode chars)
          groups.other.push(char);
        }
      } catch (e) {
        // Skip invalid code points
        console.warn(`Invalid code point: ${codePoint}`, e);
      }
    });

    // Sort and remove duplicates within each group
    Object.keys(groups).forEach(key => {
      const group = groups[key as keyof typeof groups];
      groups[key as keyof typeof groups] = [...new Set(group)].sort((a, b) => {
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });
    });

    return groups;
  }, [characterSet]);

  useEffect(() => {
    if (authLoading) return;

    // Catalogue is private: don't fetch a family when logged out.
    if (!user) {
      setIsLoading(false);
      return;
    }

    if (!familyId) {
      setError('Font family ID is not available in the route.');
      setIsLoading(false);
      return;
    }

    const fetchFamilyData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rawFamilyData = await getFontFamilyById(familyId, user?.uid);
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
  }, [familyId, user, authLoading]);

  if (authLoading || isLoading) {
    return <FontDetailLoader />;
  }

  if (!user) {
    return (
      <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
        <NavBar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center p-10 rule rounded-[var(--radius)] max-w-lg">
            <p className="text-xl mb-4">Sign in to view this family.</p>
            <Link href="/" className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink inline-block">
              ← Back home
            </Link>
          </div>
        </div>
      </div>
    );
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
              <input
                ref={addStyleInputRef}
                type="file"
                multiple
                accept=".ttf,.otf,.woff,.woff2"
                className="hidden"
                onChange={handleAddStyleFiles}
              />
              <button
                onClick={() => addStyleInputRef.current?.click()}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink"
              >
                Add Style <span className="caret"></span>
              </button>
              <button
                onClick={scrollToTester}
                className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink"
              >
                Test in Text
              </button>
            </div>
          </div>
          {family.description && (
            <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
              {family.description}
            </p>
          )}
          {/* Display enriched metadata */}
          {((family.metadata?.moods?.length ?? 0) > 0 || (family.metadata?.useCases?.length ?? 0) > 0 || (family.metadata?.people?.length ?? 0) > 0) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {family.metadata?.moods?.map((mood, idx) => (
                <span key={idx} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">
                  {mood}
                </span>
              ))}
              {family.metadata?.useCases?.map((useCase, idx) => (
                <span key={idx} className="uppercase text-xs font-bold rule px-2 py-1 rounded-[var(--radius)] btn-ink">
                  {useCase}
                </span>
              ))}
            </div>
          )}
          {family.metadata?.people && family.metadata.people.length > 0 && (
            <div className="mt-3 text-sm opacity-80">
              {family.metadata.people.map((person, idx) => (
                <span key={idx}>
                  {person.role === 'designer' ? 'Designed by' : person.role === 'foundry' ? 'Foundry' : 'Contributor'}: {person.name}
                  {idx < family.metadata.people!.length - 1 ? ', ' : ''}
                </span>
              ))}
            </div>
          )}
        </header>

        <Specimen family={family} />

        <UseFontPanel family={family} />

        {variableFont && (
          <section className="mt-6">
            <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4 mb-6">Variable</h2>
            <VariableFontPlayground font={variableFont} fontFamilyName={family.name} />
          </section>
        )}

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

        <div ref={testerRef}>
          <TypeTester family={family} />
        </div>

        <section className="mt-10">
          <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Character Set</h2>
          <div className="mt-6 rule p-6 rounded-[var(--radius)] overflow-x-auto">
            {characterSet.size > 0 ? (
              <div
                className="text-xl tracking-wide"
                style={{ fontFamily: family.name }}
              >
                {groupedCharacters.uppercase.length > 0 && (
                  <div className="mb-4">
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Uppercase ({groupedCharacters.uppercase.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.uppercase.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                {groupedCharacters.lowercase.length > 0 && (
                  <div className="mb-4">
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Lowercase ({groupedCharacters.lowercase.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.lowercase.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                {groupedCharacters.numbers.length > 0 && (
                  <div className="mb-4">
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Numbers ({groupedCharacters.numbers.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.numbers.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                {groupedCharacters.punctuation.length > 0 && (
                  <div className="mb-4">
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Punctuation ({groupedCharacters.punctuation.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.punctuation.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                {groupedCharacters.symbols.length > 0 && (
                  <div className="mb-4">
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Symbols ({groupedCharacters.symbols.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.symbols.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                {groupedCharacters.other.length > 0 && (
                  <div>
                    <div className="uppercase text-xs font-bold opacity-80 mb-2">
                      Other ({groupedCharacters.other.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {groupedCharacters.other.map((char, idx) => (
                        <span key={idx}>{char}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6 pt-4 rule-t text-sm opacity-70">
                  Total: {characterSet.size} characters
                </div>
              </div>
            ) : (
              <div className="text-base opacity-70">
                Character set information not available for this font.
              </div>
            )}
          </div>
        </section>

        <footer className="mt-10 rule-t pt-4 sm:pt-5 md:pt-6 text-sm sm:text-base">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rule-r pr-4">
              <div className="uppercase font-bold">About</div>
              <p className="mt-2">
                {family.description || 'No description yet. Once analysis runs, this family earns its own write-up.'}
              </p>
              {family.metadata?.historical_context && (
                <div className="mt-3 space-y-1">
                  {family.metadata.historical_context.period && (
                    <p className="text-xs opacity-70">
                      <span className="font-bold">Period:</span> {family.metadata.historical_context.period}
                    </p>
                  )}
                  {family.metadata.historical_context.cultural_influence && family.metadata.historical_context.cultural_influence.length > 0 && (
                    <p className="text-xs opacity-70">
                      <span className="font-bold">Influences:</span> {family.metadata.historical_context.cultural_influence.join(', ')}
                    </p>
                  )}
                </div>
              )}
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
                {family.metadata?.foundry && (
                  <p>
                    <span className="font-bold">Foundry:</span> {family.metadata.foundry}
                  </p>
                )}
                {family.metadata?.subClassification && (
                  <p>
                    <span className="font-bold">Style:</span> {family.metadata.subClassification}
                  </p>
                )}
                {family.metadata?.license && (
                  <p>
                    <span className="font-bold">License:</span> {family.metadata.license.type}
                  </p>
                )}
              </div>
            </div>
            <div>
              <div className="uppercase font-bold">Actions</div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleDownload}
                  disabled={downloadLabel === 'Preparing…'}
                  className="uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm"
                >
                  {downloadLabel}
                </button>
                <button
                  onClick={handleShare}
                  className="uppercase font-bold rule px-3 py-2 rounded-[var(--radius)] btn-ink text-sm"
                >
                  {shareLabel}
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
