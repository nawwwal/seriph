/** Footer meta row for shelf/search family covers. */
export default function FamilyCoverMeta({
  styleCount,
  isVariable,
  classification,
}: {
  styleCount: number;
  isVariable?: boolean;
  classification: string;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs uppercase">
      <div>
        <span className="font-bold">Styles:</span> <span>{styleCount}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {isVariable ? (
          <span className="rounded-[var(--radius)] rule px-1.5 py-0.5 text-[10px] font-bold">
            Var
          </span>
        ) : null}
        <span className="font-bold">{classification}</span>
      </div>
    </div>
  );
}
