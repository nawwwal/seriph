'use client';

import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Font, FontFamily } from '@/models/font.models';
import { selectDefaultFace } from '@/components/font/typePlaygroundState';

export interface FamilyDetailContextState {
  family: FontFamily;
  isPreview: boolean;
  error: string | null;
  selectedFaceId: string | null;
  selectedFace: Font | undefined;
}

export interface FamilyDetailContextActions {
  selectFace: (face: Font | undefined) => void;
  focusPlayground: () => void;
  retryLoad: () => void;
  addStyleFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  registerEditor: (node: HTMLTextAreaElement | null) => void;
}

export interface FamilyDetailContextMeta {
  testerRef: RefObject<HTMLDivElement | null>;
  editorRef: RefObject<HTMLTextAreaElement | null>;
}

export interface FamilyDetailContextValue {
  state: FamilyDetailContextState;
  actions: FamilyDetailContextActions;
  meta: FamilyDetailContextMeta;
}

const FamilyDetailContext = createContext<FamilyDetailContextValue | undefined>(undefined);

export function FamilyDetailProvider({
  family,
  isPreview,
  error,
  onRetryLoad,
  onAddStyleFiles,
  children,
}: {
  family: FontFamily;
  isPreview: boolean;
  error: string | null;
  onRetryLoad: () => void;
  onAddStyleFiles: (event: React.ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}) {
  const testerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);
  const selectedFace = useMemo(() => {
    const fonts = family.fonts ?? [];
    return fonts.find((font) => font.id === selectedFaceId) ?? selectDefaultFace(fonts) ?? fonts[0];
  }, [family.fonts, selectedFaceId]);

  const selectFace = useCallback((face: Font | undefined) => setSelectedFaceId(face?.id ?? null), []);
  const focusPlayground = useCallback(() => {
    testerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    requestAnimationFrame(() => editorRef.current?.focus({ preventScroll: true }));
  }, []);
  const registerEditor = useCallback((node: HTMLTextAreaElement | null) => {
    editorRef.current = node;
  }, []);

  const state = useMemo<FamilyDetailContextState>(
    () => ({ family, isPreview, error, selectedFaceId, selectedFace }),
    [family, isPreview, error, selectedFaceId, selectedFace],
  );
  const actions = useMemo<FamilyDetailContextActions>(
    () => ({ selectFace, focusPlayground, retryLoad: onRetryLoad, addStyleFiles: onAddStyleFiles, registerEditor }),
    [selectFace, focusPlayground, onRetryLoad, onAddStyleFiles, registerEditor],
  );
  const meta = useMemo<FamilyDetailContextMeta>(() => ({ testerRef, editorRef }), []);
  const value = useMemo<FamilyDetailContextValue>(() => ({ state, actions, meta }), [state, actions, meta]);

  return <FamilyDetailContext.Provider value={value}>{children}</FamilyDetailContext.Provider>;
}

export function useOptionalFamilyDetail(): FamilyDetailContextValue | undefined {
  return use(FamilyDetailContext);
}

export function useFamilyDetailContext(): FamilyDetailContextValue {
  const ctx = use(FamilyDetailContext);
  if (!ctx) throw new Error('useFamilyDetailContext must be used within FamilyDetailProvider');
  return ctx;
}
