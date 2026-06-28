'use client';

import { Font, VariableAxis } from '@/models/font.models';
import React, { useState, useEffect, useMemo } from 'react';

interface VariableFontPlaygroundProps {
  font: Font;
  fontFamilyName: string; // To ensure unique @font-face name
}

const VariableFontPlayground: React.FC<VariableFontPlaygroundProps> = ({ font, fontFamilyName }) => {
  const axes = useMemo(() => font.variableAxes ?? [], [font.variableAxes]);
  const isVariableFont = font.isVariable && axes.length > 0;

  const initialAxisValues = useMemo(() => {
    return axes.reduce<Record<string, number>>((values, axis) => {
      values[axis.tag] = axis.defaultValue;
      return values;
    }, {});
  }, [axes]);

  const [currentAxisValues, setCurrentAxisValues] = useState<Record<string, number>>(initialAxisValues);

  useEffect(() => {
    setCurrentAxisValues(initialAxisValues);
  }, [initialAxisValues]);

  const handleSliderChange = (tag: string, value: number) => {
    setCurrentAxisValues(prev => ({ ...prev, [tag]: value }));
  };

  // Generate the font-variation-settings CSS string
  const fontVariationSettings = useMemo(() => {
    if (!isVariableFont) return '';
    return axes.map(axis => `'${axis.tag}' ${currentAxisValues[axis.tag]}`).join(', ');
  }, [axes, currentAxisValues, isVariableFont]);

  const uniqueFontFamilyCssName = useMemo(() =>
    `VFPlayground_${fontFamilyName.replace(/\s+/g, '_')}_${font.subfamily.replace(/\s+/g, '_')}`
  , [fontFamilyName, font.subfamily]);

  // Dynamically create @font-face rule
  useEffect(() => {
    if (!isVariableFont) return;

    const styleSheetId = `font-style-${uniqueFontFamilyCssName}`;
    let styleElement = document.getElementById(styleSheetId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleSheetId;
      document.head.appendChild(styleElement);
    }

    const cdn = (font as any)?.metadata?.cdnUrl as string | undefined;
    const storagePath = (font as any)?.metadata?.storagePath as string | undefined;
    const src = cdn || (storagePath ? `/api/font/gcs?path=${encodeURIComponent(storagePath)}` : undefined);
    if (!src) return;
    const srcExt = (src.split('?')[0].split('.').pop() || '').toLowerCase();
    const cssFormat = srcExt === 'woff2' ? 'woff2' : font.format === 'TTF' ? 'truetype' : font.format.toLowerCase();
    const fontFaceRule = `
      @font-face {
        font-family: '${uniqueFontFamilyCssName}';
        src: url('${src}') format('${cssFormat}');
        font-weight: normal; /* Default, actual variation via settings */
        font-style: normal;  /* Default, actual variation via settings */
      }
    `;
    styleElement.innerHTML = fontFaceRule;

    return () => {
      // Optional: Cleanup style element when component unmounts or font changes
      // if (styleElement) {
      //   document.head.removeChild(styleElement);
      // }
    };
  }, [ (font as any)?.metadata?.cdnUrl, (font as any)?.metadata?.storagePath, font.format, uniqueFontFamilyCssName, isVariableFont ]);

  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog.');
  const [previewFontSize, setPreviewFontSize] = useState(48);

  if (!isVariableFont) {
    return <p className="text-sm opacity-70">This font is not variable or has no defined axes.</p>;
  }


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
          style={{
            fontFamily: `'${uniqueFontFamilyCssName}', sans-serif`,
            fontVariationSettings,
            fontSize: `${previewFontSize}px`,
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        {axes.map((axis: VariableAxis) => (
          <div key={axis.tag} className="flex flex-col">
            <div className="flex justify-between items-center mb-1">
                <label htmlFor={`slider-${axis.tag}`} className="text-sm font-medium opacity-70">
                {axis.name} ({axis.tag})
                </label>
                <span className="text-sm text-[var(--info)] font-mono bg-[color-mix(in_srgb,var(--info)_12%,transparent)] px-2 py-0.5 rounded">
                    {currentAxisValues[axis.tag]}
                </span>
            </div>
            <input
              type="range"
              id={`slider-${axis.tag}`}
              min={axis.minValue}
              max={axis.maxValue}
              step={ (axis.tag === 'wght' || axis.maxValue - axis.minValue > 100) ? 1 : ((axis.maxValue - axis.minValue) / 100) }
              value={currentAxisValues[axis.tag]}
              onChange={(e) => handleSliderChange(axis.tag, parseFloat(e.target.value))}
              className="w-full h-2 bg-[var(--muted)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-offset-1 focus-visible:ring-[var(--focus)]"
              aria-valuenow={currentAxisValues[axis.tag]}
              aria-label={`${axis.name} (${axis.tag})`}
            />
          </div>
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
};

export default VariableFontPlayground;
