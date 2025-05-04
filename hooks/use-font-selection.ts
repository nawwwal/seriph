"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { create } from "zustand";

interface FontSelectionState {
  selectedFonts: string[];
  selectFont: (id: string) => void;
  deselectFont: (id: string) => void;
  clearSelection: () => void;
  selectMultiple: (ids: string[]) => void;
  deselectMultiple: (ids: string[]) => void;
}

const useFontSelectionStore = create<FontSelectionState>((set) => ({
  selectedFonts: [],
  selectFont: (id: string) =>
    set((state) => ({
      selectedFonts: [...state.selectedFonts, id],
    })),
  deselectFont: (id: string) =>
    set((state) => ({
      selectedFonts: state.selectedFonts.filter((fontId) => fontId !== id),
    })),
  clearSelection: () =>
    set({
      selectedFonts: [],
    }),
  selectMultiple: (ids: string[]) =>
    set((state) => ({
      selectedFonts: Array.from(new Set([...state.selectedFonts, ...ids])),
    })),
  deselectMultiple: (ids: string[]) =>
    set((state) => ({
      selectedFonts: state.selectedFonts.filter((fontId) => !ids.includes(fontId)),
    })),
}));

export function useFontSelection() {
  const {
    selectedFonts,
    selectFont,
    deselectFont,
    clearSelection,
    selectMultiple,
    deselectMultiple,
  } = useFontSelectionStore();

  const toggleSelectAll = useCallback((ids: string[]) => {
    const allSelected = isAllSelected(ids);
    if (allSelected) {
      deselectMultiple(ids);
    } else {
      selectMultiple(ids);
    }
  }, [deselectMultiple, selectMultiple]);

  const isAllSelected = useCallback((ids: string[]) => {
    return ids.every(id => selectedFonts.includes(id));
  }, [selectedFonts]);

  return {
    selectedFonts,
    selectFont,
    deselectFont,
    clearSelection,
    toggleSelectAll,
    isAllSelected,
  };
}