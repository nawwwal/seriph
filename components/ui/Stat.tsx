interface StatProps {
  label: string;
  value: string | number;
  showBorder?: boolean;
}

export default function Stat({ label, value, showBorder = true }: StatProps) {
  return (
    <div className={`p-3 sm:p-4 ${showBorder ? 'rule-r' : ''}`}>
      <div className="uppercase text-xs sm:text-sm font-bold opacity-80">{label}</div>
      <div className="text-2xl sm:text-3xl font-black cap-tight">{value}</div>
    </div>
  );
}

