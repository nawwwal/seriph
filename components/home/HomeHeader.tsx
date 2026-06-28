interface HomeHeaderProps {
  isEmpty: boolean;
  onAddFonts: () => void;
  onRegenerateCovers: () => void;
}

export default function HomeHeader({ isEmpty, onAddFonts, onRegenerateCovers }: HomeHeaderProps) {
  return (
    <header className="w-full rule-b pb-4 sm:pb-5 md:pb-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,9.5vw,140px)] leading-[0.9]">
          Seriph
        </h1>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <button
            onClick={onAddFonts}
            className={`uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink text-sm sm:text-base ${isEmpty ? 'pulse-animation' : ''}`}
          >
            Add Fonts <span className="caret"></span>
          </button>
          {!isEmpty && (
            <button
              onClick={onRegenerateCovers}
              className="uppercase font-bold rule px-4 py-2 rounded-[var(--radius)] text-sm sm:text-base btn-ink"
            >
              Regenerate Covers
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg tracking-tight">
        Your type library. Drop in font files and Seriph groups them into families, renders a
        specimen for each, and makes the whole shelf searchable by mood and intent.
      </p>
    </header>
  );
}
