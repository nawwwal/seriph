'use client';

export default function AddFontsCard({ onAddFonts }: { onAddFonts: () => void }) {
  return (
    <div
      className="relative rule p-4 sm:p-5 md:p-6 rounded-[var(--radius)] flex flex-col justify-between group cursor-pointer seriph-card-hover"
      onClick={onAddFonts}
    >
      <div>
        <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight">Drop Fonts</div>
        <p className="mt-2 text-sm sm:text-base">Drag files here or use Add Fonts.</p>
      </div>
      <div className="mt-6 rule-t pt-3 uppercase text-sm font-bold caret">TTF, OTF, WOFF, WOFF2</div>
    </div>
  );
}
