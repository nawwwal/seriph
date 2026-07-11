'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type { FontFamily } from '@/models/font.models';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import TypePlaygroundControls from './TypePlaygroundControls';
import TypePlaygroundEditor from './TypePlaygroundEditor';
import { buildVariationSettings, isItalicFace, serializePlaygroundCss,
  uniqueFacesById } from './typePlaygroundModel';
import { createPlaygroundState, reconcilePlaygroundState, resetFaceState,
  type FacePlaygroundState } from './typePlaygroundState';
import { letterSpacingCss, lineHeightCss } from './typePlaygroundUnits';

interface TypePlaygroundProps {
  family: FontFamily;
  testerRef: RefObject<HTMLDivElement | null>;
}

export default function TypePlayground({ family, testerRef }: TypePlaygroundProps) {
  useRegisterFamilyFonts(family);
  const fonts = useMemo(() => uniqueFacesById(family.fonts ?? []), [family.fonts]);
  const [storedState, setStoredState] = useState(() => createPlaygroundState(fonts, family.name));
  const state = useMemo(
    () => reconcilePlaygroundState(storedState, fonts, family.name),
    [family.name, fonts, storedState]
  );
  const [copyLabel, setCopyLabel] = useState('Copy CSS');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFace = fonts.find((font) => font.id === state.selectedFaceId) ?? fonts[0];
  const faceState = selectedFace
    ? state.faces[selectedFace.id] ?? resetFaceState(selectedFace, family.name)
    : undefined;
  const axes = selectedFace?.isVariable ? selectedFace.variableAxes ?? [] : [];
  const variableFamily = useVariableFontFace(selectedFace, family.name, axes.length > 0);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  if (!selectedFace || !faceState) return null;
  const patchFace = (patch: Partial<FacePlaygroundState>) => setStoredState((current) => {
    const reconciled = reconcilePlaygroundState(current, fonts, family.name);
    const currentFace = reconciled.faces[selectedFace.id] ?? faceState;
    return { ...reconciled, faces: {
      ...reconciled.faces, [selectedFace.id]: { ...currentFace, ...patch },
    } };
  });
  const copyCss = async () => {
    await navigator.clipboard.writeText(serializePlaygroundCss({ familyName: family.name, face: selectedFace, state: faceState }));
    setCopyLabel('Copied');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyLabel('Copy CSS'), 1_600);
  };
  const variations = buildVariationSettings(axes, faceState.axisValues);
  return (
    <div ref={testerRef}>
      <section className="mt-6">
        <h2 className="uppercase font-black text-2xl sm:text-3xl rule-b pb-4">Type Playground</h2>
        <div className="mt-6 rule p-4 sm:p-6 rounded-[var(--radius)]">
          <TypePlaygroundControls fonts={fonts} selectedFace={selectedFace} state={faceState}
            axes={axes} copyLabel={copyLabel} onSelectFace={(selectedFaceId) => setStoredState((current) => ({
              ...reconcilePlaygroundState(current, fonts, family.name), selectedFaceId,
            }))}
            onPatch={patchFace} onAxisChange={(tag, value) => patchFace({ axisValues: { ...faceState.axisValues, [tag]: value } })}
            onReset={() => patchFace(resetFaceState(selectedFace, family.name))} onCopy={() => void copyCss()}>
            <TypePlaygroundEditor value={faceState.text} onChange={(text) => patchFace({ text })}
              fontFamily={axes.length ? `'${variableFamily}'` : family.name}
              fontWeight={axes.length ? Math.round(faceState.axisValues.wght ?? selectedFace.weight) : selectedFace.weight}
              fontStyle={axes.length ? 'normal' : isItalicFace(selectedFace) ? 'italic' : 'normal'}
              fontSize={faceState.fontSize} letterSpacing={letterSpacingCss(faceState.letterSpacingValue, faceState.letterSpacingMode)}
              lineHeight={lineHeightCss(faceState.lineHeightValue, faceState.lineHeightMode)} fontVariationSettings={variations} />
          </TypePlaygroundControls>
        </div>
      </section>
    </div>
  );
}
