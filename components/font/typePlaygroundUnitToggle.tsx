'use client';

const modeClass = (active: boolean) =>
  `px-2 py-1 text-xs font-bold uppercase rule ${active ? 'ink-bg' : ''}`;

/** Compact unit mode chips for playground sliders (em/px, %/px, …). */
export default function TypePlaygroundUnitToggle<T extends string>({
  modes,
  value,
  onChange,
  label,
  format = (mode) => mode,
}: {
  modes: readonly T[];
  value: T;
  onChange: (mode: T) => void;
  label: string;
  format?: (mode: T) => string;
}) {
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label={label}>
      {modes.map((mode) => (
        <button
          type="button"
          key={mode}
          className={modeClass(value === mode)}
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
        >
          {format(mode)}
        </button>
      ))}
    </div>
  );
}
