'use client';

import { Font } from '@/models/font.models';
import React, { useState, useMemo } from 'react';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import AxisSlider from './AxisSlider';

interface VariableFontPlaygroundProps {
  font: Font;
  fontFamilyName: string;
}

const VariableFontPlayground: React.FC<VariableFontPlaygroundProps> = ({ font, fontFamilyName }) => {
  const axes = useMemo(() => font.variableAxes ?? [], [font.variableAxes]);
  const isVariableFont = font.isVariable && axes.length > 0;

  const initialAxisValues = useMemo(
    () => axes.reduce<Record<string, number>>((v, axis) => ((v[axis.tag] = axis.defaultValue), v), {}),
    [axes]
  );
  const axisKey = useMemo(
    () => axes.map((axis) => `${axis.tag}:${axis.defaultValue}:${axis.minValue}:${axis.maxValue}`).join('|'),
    [axes]
  );
  const cssName = useVariableFontFace(font, fontFamilyName, isVariableFont);

  if (!isVariableFont) {
    return <p className="text-sm opacity-70">This font is not variable or has no defined axes.</p>;
  }

  return (
    <VariableFontPlaygroundControls
      key={axisKey}
      axes={axes}
      cssName={cssName}
      font={font}
      initialAxisValues={initialAxisValues}
    />
  );
};

interface VariableFontPlaygroundControlsProps {
  axes: NonNullable<Font['variableAxes']>;
  cssName: string;
  font: Font;
  initialAxisValues: Record<string, number>;
}

function VariableFontPlaygroundControls({
  axes,
  cssName,
  font,
  initialAxisValues,
}: VariableFontPlaygroundControlsProps) {
  const [currentAxisValues, setCurrentAxisValues] = useState<Record<string, number>>(initialAxisValues);

  const handleSliderChange = (tag: string, value: number) =>
    setCurrentAxisValues((prev) => ({ ...prev, [tag]: value }));

  const fontVariationSettings = useMemo(
    () => axes.map((a) => `'${a.tag}' ${currentAxisValues[a.tag]}`).join(', '),
    [axes, currentAxisValues]
  );

  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog.');
  const [previewFontSize, setPreviewFontSize] = useState(48);

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
              className="w-full h-2 bg-[var(--muted)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus-visible:ring-[var(--focus)]"
              aria-valuenow={previewFontSize}
              aria-label="Preview font size"
            />
            <span className="text-sm text-[var(--info)] font-mono bg-[color-mix(in_srgb,var(--info)_12%,transparent)] px-2 py-0.5 rounded min-w-[50px] text-center">
              {previewFontSize}px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VariableFontPlayground;
