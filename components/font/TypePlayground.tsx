'use client';

import { useMemo, useState } from 'react';
import type { FontFamily } from '@/models/font.models';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import TypePlaygroundEditor from './TypePlaygroundEditor';
import TypePlaygroundControls from './TypePlaygroundControls';
import {
  cssLength, defaultSampleText, isItalicFace, initialAxisValues, buildVariationSettings, type MetricUnit,
} from './typePlaygroundModel';
import { applyTypedMetric, PLAYGROUND_DEFAULTS, switchMetricUnit } from './typePlaygroundState';

export default function TypePlayground({ family }: { family: FontFamily }) {
  useRegisterFamilyFonts(family);
  const fonts = family.fonts ?? [];
  const [selectedStyle, setSelectedStyle] = useState(fonts[0]?.subfamily || 'Regular');
  const [text, setText] = useState(() => defaultSampleText(family.name));
  const [fontSize, setFontSize] = useState<number>(PLAYGROUND_DEFAULTS.fontSize);
  const [letterSpacing, setLetterSpacing] = useState<number>(PLAYGROUND_DEFAULTS.letterSpacing);
  const [letterSpacingUnit, setLetterSpacingUnit] = useState<MetricUnit>(PLAYGROUND_DEFAULTS.letterSpacingUnit);
  const [lineHeight, setLineHeight] = useState<number>(PLAYGROUND_DEFAULTS.lineHeight);
  const [lineHeightUnit, setLineHeightUnit] = useState<MetricUnit>(PLAYGROUND_DEFAULTS.lineHeightUnit);
  const selectedFace = fonts.find((f) => f.subfamily === selectedStyle) || fonts[0];
  const axes = useMemo(() => (selectedFace?.isVariable ? selectedFace.variableAxes ?? [] : []), [selectedFace]);
  const isVariable = Boolean(selectedFace?.isVariable && axes.length > 0);
  const [axisValues, setAxisValues] = useState(() => initialAxisValues(axes));
  const vfCssName = useVariableFontFace(selectedFace, family.name, isVariable);
  const italic = selectedFace ? isItalicFace(selectedFace) : false;

  const setSpacing = (value: number, typedUnit?: MetricUnit) => {
    const next = applyTypedMetric(value, typedUnit, letterSpacingUnit, 'spacing');
    setLetterSpacingUnit(next.unit);
    setLetterSpacing(next.value);
  };
  const setLeading = (value: number, typedUnit?: MetricUnit) => {
    const next = applyTypedMetric(value, typedUnit, lineHeightUnit, 'leading');
    setLineHeightUnit(next.unit);
    setLineHeight(next.value);
  };

  return (
    <section className="mt-6">
      <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Type Playground</h2>
      <div className="mt-6 rule p-6 rounded-[var(--radius)]">
        <TypePlaygroundControls
          fonts={fonts}
          selectedStyle={selectedStyle}
          onStyleChange={(style) => {
            setSelectedStyle(style);
            const face = fonts.find((f) => f.subfamily === style) || fonts[0];
            setAxisValues(initialAxisValues(face?.isVariable ? face.variableAxes ?? [] : []));
          }}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          letterSpacing={letterSpacing}
          letterSpacingUnit={letterSpacingUnit}
          onLetterSpacingChange={setSpacing}
          onLetterSpacingUnitChange={(unit) => {
            setLetterSpacing(switchMetricUnit(letterSpacing, letterSpacingUnit, unit, fontSize, 'spacing'));
            setLetterSpacingUnit(unit);
          }}
          lineHeight={lineHeight}
          lineHeightUnit={lineHeightUnit}
          onLineHeightChange={setLeading}
          onLineHeightUnitChange={(unit) => {
            setLineHeight(switchMetricUnit(lineHeight, lineHeightUnit, unit, fontSize, 'leading'));
            setLineHeightUnit(unit);
          }}
          axes={axes}
          axisValues={axisValues}
          onAxisChange={(tag, value) => setAxisValues((prev) => ({ ...prev, [tag]: value }))}
          onReset={() => {
            setText(defaultSampleText(family.name));
            setFontSize(PLAYGROUND_DEFAULTS.fontSize);
            setLetterSpacing(PLAYGROUND_DEFAULTS.letterSpacing);
            setLetterSpacingUnit(PLAYGROUND_DEFAULTS.letterSpacingUnit);
            setLineHeight(PLAYGROUND_DEFAULTS.lineHeight);
            setLineHeightUnit(PLAYGROUND_DEFAULTS.lineHeightUnit);
            setAxisValues(initialAxisValues(axes));
          }}
          onCopy={() => void navigator.clipboard.writeText(text)}
        >
          <TypePlaygroundEditor
            value={text}
            onChange={setText}
            fontFamily={isVariable ? `'${vfCssName}'` : family.name}
            fontWeight={isVariable ? Math.round(axisValues.wght ?? selectedFace?.weight ?? 400) : selectedFace?.weight || 400}
            fontStyle={isVariable ? 'normal' : italic ? 'italic' : 'normal'}
            fontSize={fontSize}
            letterSpacing={cssLength(letterSpacing, letterSpacingUnit)}
            lineHeight={cssLength(lineHeight, lineHeightUnit)}
            fontVariationSettings={buildVariationSettings(axes, axisValues)}
          />
        </TypePlaygroundControls>
      </div>
    </section>
  );
}
