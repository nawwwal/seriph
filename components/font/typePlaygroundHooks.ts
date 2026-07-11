'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Font, FontFamily } from '@/models/font.models';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import {
  buildPlaygroundFaceRegistration,
  uniqueFacesById,
} from './typePlaygroundModel';
import {
  createPlaygroundState,
  reconcilePlaygroundState,
  resetFaceState,
  type FacePlaygroundState,
  type TypePlaygroundState,
} from './typePlaygroundState';

/** Shared face selection, registration, and copy-label state for the playground. */
export function useTypePlayground(family: FontFamily) {
  useRegisterFamilyFonts(family);
  const fonts = useMemo(() => uniqueFacesById(family.fonts ?? []), [family.fonts]);
  const [storedState, setStoredState] = useState(() => createPlaygroundState(fonts, family.name));
  const state = useMemo(
    () => reconcilePlaygroundState(storedState, fonts, family.name),
    [family.name, fonts, storedState],
  );
  const [copyLabel, setCopyLabel] = useState('Copy CSS');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFace = fonts.find((font) => font.id === state.selectedFaceId) ?? fonts[0];
  const faceState = selectedFace
    ? state.faces[selectedFace.id] ?? resetFaceState(selectedFace, family.name)
    : undefined;
  const axes = selectedFace?.isVariable ? selectedFace.variableAxes ?? [] : [];
  const variableFamily = useVariableFontFace(selectedFace, family.name, axes.length > 0);
  const fixedRegistration = useMemo(
    () =>
      selectedFace && !selectedFace.isVariable
        ? buildPlaygroundFaceRegistration(family.name, selectedFace)
        : null,
    [family.name, selectedFace],
  );

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!fixedRegistration) return;
    const style = document.createElement('style');
    style.id = fixedRegistration.styleId;
    style.textContent = fixedRegistration.rule;
    document.head.appendChild(style);
    return () => style.remove();
  }, [fixedRegistration]);

  const patchFace = (patch: Partial<FacePlaygroundState>) => {
    if (!selectedFace || !faceState) return;
    setStoredState((current) => {
      const reconciled = reconcilePlaygroundState(current, fonts, family.name);
      const currentFace = reconciled.faces[selectedFace.id] ?? faceState;
      return {
        ...reconciled,
        faces: { ...reconciled.faces, [selectedFace.id]: { ...currentFace, ...patch } },
      };
    });
  };

  const selectFace = (selectedFaceId: string) =>
    setStoredState((current) => ({
      ...reconcilePlaygroundState(current, fonts, family.name),
      selectedFaceId,
    }));

  const flashCopyLabel = (ok: boolean) => {
    setCopyLabel(ok ? 'Copied' : 'Copy failed');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyLabel('Copy CSS'), 1_600);
  };

  return {
    fonts,
    state,
    selectedFace: selectedFace as Font | undefined,
    faceState,
    axes,
    variableFamily,
    fixedRegistration,
    copyLabel,
    patchFace,
    selectFace,
    flashCopyLabel,
    setStoredState: setStoredState as (value: TypePlaygroundState) => void,
    familyName: family.name,
  };
}
