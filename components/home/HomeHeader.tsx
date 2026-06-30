import { Button } from '@/components/ui/Button';

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
          <Button
            onClick={onAddFonts}
            className={isEmpty ? 'pulse-animation' : undefined}
          >
            Add Fonts <span className="caret"></span>
          </Button>
          {!isEmpty && (
            <Button
              onClick={onRegenerateCovers}
            >
              Regenerate Covers
            </Button>
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
