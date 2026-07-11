'use client';

import FamilyCoverMeta from './familyCoverMeta';

/** Sample + footer block for a family cover card. */
export default function FamilyCoverBody({
  name,
  sampleChars,
  description,
  styleCount,
  isVariable,
  classification,
}: {
  name: string;
  sampleChars: string;
  description?: string;
  styleCount: number;
  isVariable?: boolean;
  classification: string;
}) {
  return (
    <>
      <div className="relative flex flex-1 items-end bg-[color-mix(in_srgb,var(--ink)_6%,var(--paper))] p-4 sm:p-5 md:p-6">
        <div
          className="family-sample relative z-10 w-full truncate-2 text-6xl font-black uppercase leading-none tracking-normal sm:text-7xl lg:text-6xl xl:text-7xl"
          style={{ fontFamily: name, letterSpacing: '0' }}
        >
          {sampleChars}
        </div>
      </div>
      <div className="rule-t bg-[var(--paper)] p-3 sm:p-4">
        <div className="family-name truncate text-xl font-extrabold" style={{ fontFamily: name }}>
          {name}
        </div>
        {description ? (
          <p className="mt-2 line-clamp-2 text-xs font-normal normal-case leading-snug opacity-70">
            {description}
          </p>
        ) : null}
        <FamilyCoverMeta
          styleCount={styleCount}
          isVariable={isVariable}
          classification={classification}
        />
      </div>
    </>
  );
}
