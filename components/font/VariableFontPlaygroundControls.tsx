'use client';

import { useMemo, useState } from 'react';
import { Font } from '@/models/font.models';
import AxisSlider from './AxisSlider';

interface VariableFontPlaygroundControlsProps {
  axes: NonNullable<Font['variableAxes']>;
  cssName: string;
  font: Font;
  initialAxisValues: Record<string, number>;
}

export default function VariableFontPlaygroundControls({
  axes,
  cssName,
  font,
  initialAxisValues,
}: VariableFontPlaygroundControlsProps) {
  const [currentAxisValues, setCurrentAxisValues] = useState<Record<string, number>>(initialAxisValues);
  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog.');
  const [previewFontSize, setPreviewFontSize] = useState(48);
  const handleSliderChange = (tag: string, value: number) =>
    setCurrentAxisValues((prev) => ({ ...prev, [tag]: value }));
  const fontVariationSettings = useMemo(
    () => axes.map((a) => `'${a.tag}' ${currentAxisValues[a.tag]}`).join(', '),
    [axes, currentAxisValues]
  );

  return (
    <div className="rule p-6 rounded-[var(--radius)]">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h4 className="uppercase font-bold text-sm">{font.subfamily} · Variable Playground</h4>
        <p className="text-xs opacity-60">{font.format} · {(font.fileSize / 1024).toFixed(1)} KB</p>
      </div>
      <div className="mb-6">
        <textarea
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="w-full p-3 rule rounded-[var(--radius)] bg-[var(--paper)] resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] min-h-[150px] md:min-h-[200px]"
          style={{ fontFamily: `'${cssName}', sans-serif`, fontVariationSettings, fontSize: `${previewFontSize}px` }}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        {axes.map((axis) => (
          <AxisSlider key={axis.tag} axis={axis} value={currentAxisValues[axis.tag]} onChange={handleSliderChange} />
        ))}
        <div>
          <label htmlFor="fontSizeSlider" className="text-sm font-medium opacity-70 block mb-1">Preview Font Size</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              id="fontSizeSlider"
              min="12"
              max="128"
              step="1"
              value={previewFontSize}
              onChange={(e) => setPreviewFontSize(Number(e.target.value))}
              className="theme-range w-full focus:outline-none focus:ring-2 focus:ring-offset-1 focus-visible:ring-[var(--focus)]"
              aria-valuenow={previewFontSize}
              aria-label="Preview font size"
            />
            <span className="theme-value text-sm font-mono px-2 py-0.5 rounded-[var(--radius)] min-w-[50px] text-center">
              {previewFontSize}px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
