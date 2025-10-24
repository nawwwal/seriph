'use client';

import { FontFamily } from '@/models/font.models';
import FamilyCover from '@/components/font/FamilyCover';
import { useRef } from 'react';

interface ShelfStateProps {
  families: FontFamily[];
  shelfMode: 'spines' | 'covers';
  onShelfModeChange: (mode: 'spines' | 'covers') => void;
  onAddFonts: () => void;
}

export default function ShelfState({
  families,
  shelfMode,
  onShelfModeChange,
  onAddFonts,
}: ShelfStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalStyles = families.reduce((sum, family) => sum + family.fonts.length, 0);
  const recentFamily = families.length > 0 ? families[0].name : '—';

  return (
    <>
      <main className="mt-6 sm:mt-8 md:mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 grid-poster-gap auto-rows-fr">
        {families.map((family) => (
          <FamilyCover key={family.id} family={family} mode={shelfMode} />
        ))}

        <div
          className="relative rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between group cursor-pointer"
          onClick={onAddFonts}
        >
          <div>
            <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight">
              Drop Fonts
            </div>
            <p className="mt-2 text-sm sm:text-base">Drag files here or use Add Fonts.</p>
          </div>
          <div className="mt-6 rule-t pt-3 uppercase text-sm font-bold caret">
            TTF, OTF, WOFF, WOFF2
          </div>
          <div className="absolute inset-0 bg-[var(--accent)] opacity-0 transition-opacity pointer-events-none group-hover:opacity-5 rounded-[var(--radius)]"></div>
        </div>
      </main>
    </>
  );
}

