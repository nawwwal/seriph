'use client';

import { Font, VariableAxis } from '@/models/font.models';
import React, { useState, useEffect, useMemo } from 'react';

interface VariableFontPlaygroundProps {
  font: Font;
  fontFamilyName: string; // To ensure unique @font-face name
}

const VariableFontPlayground: React.FC<VariableFontPlaygroundProps> = ({ font, fontFamilyName }) => {
  if (!font.isVariable || !font.variableAxes || font.variableAxes.length === 0) {
    return <p className="text-sm text-gray-500">This font is not variable or has no defined axes.</p>;
  }

  // Initialize axis values from their defaultValues
  const initialAxisValues = useMemo(() => {
    const values: { [tag: string]: number } = {};
    font.variableAxes!.forEach(axis => {
      values[axis.tag] = axis.defaultValue;
    });
    return values;
  }, [font.variableAxes]);

  const [currentAxisValues, setCurrentAxisValues] = useState<{ [tag: string]: number }>(initialAxisValues);

  useEffect(() => {
    setCurrentAxisValues(initialAxisValues); // Reset if font prop changes
  }, [initialAxisValues]);

  const handleSliderChange = (tag: string, value: number) => {
    setCurrentAxisValues(prev => ({ ...prev, [tag]: value }));
  };

  // Generate the font-variation-settings CSS string
  const fontVariationSettings = useMemo(() => {
    return font.variableAxes!
      .map(axis => `'${axis.tag}' ${currentAxisValues[axis.tag]}`)
      .join(', ');
  }, [font.variableAxes, currentAxisValues]);

  const uniqueFontFamilyCssName = useMemo(() =>
    `VFPlayground_${fontFamilyName.replace(/\s+/g, '_')}_${font.subfamily.replace(/\s+/g, '_')}`
  , [fontFamilyName, font.subfamily]);

  // Dynamically create @font-face rule
  useEffect(() => {
    if (!font.downloadUrl) return;

    const styleSheetId = `font-style-${uniqueFontFamilyCssName}`;
    let styleElement = document.getElementById(styleSheetId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleSheetId;
      document.head.appendChild(styleElement);
    }

    const fontFaceRule = `
      @font-face {
        font-family: '${uniqueFontFamilyCssName}';
        src: url('${font.downloadUrl}') format('${font.format === "TTF" ? "truetype" : font.format.toLowerCase()}');
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
  }, [font.downloadUrl, font.format, uniqueFontFamilyCssName]);

  const [previewText, setPreviewText] = useState('The quick brown fox jumps over the lazy dog.');
  const [previewFontSize, setPreviewFontSize] = useState(48);


  return (
    <div className="p-6 border border-gray-200 rounded-lg shadow-sm bg-white my-6">
      <h4 className="text-xl font-semibold text-gray-700 mb-1">{font.subfamily} - Variable Playground</h4>
      <p className="text-xs text-gray-500 mb-4">Format: {font.format}, Size: {(font.fileSize / 1024).toFixed(1)} KB</p>

      <div className="mb-6">
        <textarea
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-blue-500 focus:border-blue-500 min-h-[150px] md:min-h-[200px] lg:min-h-[250px]"
          style={{
            fontFamily: `'${uniqueFontFamilyCssName}', sans-serif`,
            fontVariationSettings,
            fontSize: `${previewFontSize}px`,
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        {font.variableAxes!.map((axis: VariableAxis) => (
          <div key={axis.tag} className="flex flex-col">
            <div className="flex justify-between items-center mb-1">
                <label htmlFor={`slider-${axis.tag}`} className="text-sm font-medium text-gray-600">
                {axis.name} ({axis.tag})
                </label>
                <span className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded">
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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
              aria-valuenow={currentAxisValues[axis.tag]}
              aria-label={`${axis.name} (${axis.tag})`}
            />
          </div>
        ))}
        <div>
            <label htmlFor="fontSizeSlider" className="text-sm font-medium text-gray-600 block mb-1">Preview Font Size</label>
            <div className="flex items-center gap-2">
                <input
                type="range"
                id="fontSizeSlider"
                min="12"
                max="128"
                step="1"
                value={previewFontSize}
                onChange={(e) => setPreviewFontSize(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                aria-valuenow={previewFontSize}
                aria-label="Preview font size"
                />
                <span className="text-sm text-blue-600 font-mono bg-blue-50 px-2 py-0.5 rounded min-w-[50px] text-center">
                    {previewFontSize}px
                </span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default VariableFontPlayground;
