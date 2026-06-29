import type { VariableAxis } from '@/models/font.models';

const SLIDER_CLASS =
  'theme-range w-full focus:outline-none focus:ring-2 focus:ring-offset-1 focus-visible:ring-[var(--focus)]';
const VALUE_CLASS =
  'theme-value text-sm font-mono px-2 py-0.5 rounded-[var(--radius)]';

export default function AxisSlider({
  axis,
  value,
  onChange,
}: {
  axis: VariableAxis;
  value: number;
  onChange: (tag: string, value: number) => void;
}) {
  const step = axis.tag === 'wght' || axis.maxValue - axis.minValue > 100 ? 1 : (axis.maxValue - axis.minValue) / 100;
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-1">
        <label htmlFor={`slider-${axis.tag}`} className="text-sm font-medium opacity-70">
          {axis.name} ({axis.tag})
        </label>
        <span className={VALUE_CLASS}>{value}</span>
      </div>
      <input
        type="range"
        id={`slider-${axis.tag}`}
        min={axis.minValue}
        max={axis.maxValue}
        step={step}
        value={value}
        onChange={(e) => onChange(axis.tag, parseFloat(e.target.value))}
        className={SLIDER_CLASS}
        aria-valuenow={value}
        aria-label={`${axis.name} (${axis.tag})`}
      />
    </div>
  );
}
