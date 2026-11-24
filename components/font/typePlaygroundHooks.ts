'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Font, FontFamily } from '@/models/font.models';
import { useRegisterFamilyFonts } from '@/lib/hooks/useRegisterFamilyFonts';
import { useVariableFontFace } from '@/lib/hooks/useVariableFontFace';
import { buildPlaygroundFaceRegistration, uniqueFacesById } from './typePlaygroundModel';
import {
  createPlaygroundState,
  reconcilePlaygroundState,
  resetFaceState,
  type FacePlaygroundState,
  type TypePlaygroundState,
} from './typePlaygroundState';

export interface PlaygroundSelectionSync {
  selectedFaceId?: string | null;
  onSelectFace?: (face: Font | undefined) => void;
}

/** Shared face selection, registration, and copy-label state for the playground. */
export function useTypePlayground(family: FontFamily, sync?: PlaygroundSelectionSync) {
  useRegisterFamilyFonts(family);
  const fonts = useMemo(() => uniqueFacesById(family.fonts ?? []), [family.fonts]);
  const [storedState, setStoredState] = useState(() => createPlaygroundState(fonts, family.name));
  const reconciled = useMemo(() => reconcilePlaygroundState(storedState, fonts, family.name), [family.name, fonts, storedState]);
  const activeFaceId = sync?.selectedFaceId ?? reconciled.selectedFaceId;
  const [copyLabel, setCopyLabel] = useState('Copy CSS');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFace = fonts.find((font) => font.id === activeFaceId) ?? fonts[0];
  const faceState = selectedFace ? reconciled.faces[selectedFace.id] ?? resetFaceState(selectedFace, family.name) : undefined;
  const axes = selectedFace?.isVariable ? selectedFace.variableAxes ?? [] : [];
  const variableFamily = useVariableFontFace(selectedFace, family.name, axes.length > 0);
  const fixedRegistration = useMemo(
    () => (selectedFace && axes.length === 0 ? buildPlaygroundFaceRegistration(family.name, selectedFace) : null),
    [axes.length, family.name, selectedFace],
  );

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);
  useEffect(() => {
    if (!fixedRegistration) return;
    const style = document.createElement('style');
    style.id = fixedRegistration.styleId;
    style.textContent = fixedRegistration.rule;
    document.head.appendChild(style);
    return () => style.remove();
  }, [fixedRegistration]);

  const patchFace = useCallback((patch: Partial<FacePlaygroundState>) => {
    if (!selectedFace || !faceState) return;
    setStoredState((current) => {
      const next = reconcilePlaygroundState(current, fonts, family.name);
      const currentFace = next.faces[selectedFace.id] ?? faceState;
      return { ...next, faces: { ...next.faces, [selectedFace.id]: { ...currentFace, ...patch } } };
    });
  }, [faceState, family.name, fonts, selectedFace]);

  const onSelectSync = sync?.onSelectFace;
  const selectFace = useCallback((nextId: string) => {
    setStoredState((current) => ({ ...reconcilePlaygroundState(current, fonts, family.name), selectedFaceId: nextId }));
    onSelectSync?.(fonts.find((font) => font.id === nextId));
  }, [family.name, fonts, onSelectSync]);

  const flashCopyLabel = useCallback((ok: boolean) => {
    setCopyLabel(ok ? 'Copied' : 'Copy failed');
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyLabel('Copy CSS'), 1_600);
  }, []);

  return {
    fonts,
    state: { ...reconciled, selectedFaceId: activeFaceId },
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
