'use client';

import { useEffect, useRef, useState } from 'react';
import { filesFromDataTransfer, type WalkedFile } from '@/utils/walkDirectoryEntries';

interface Options {
  disabled?: boolean;
  onDrop: (files: WalkedFile[]) => void;
}

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/** Owns the authenticated app-wide drop boundary. Capture prevents nested dropzones double-submitting. */
export function useGlobalImportDrop({ disabled = false, onDrop }: Options) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    if (disabled) return;
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth.current += 1;
      setIsDragging(true);
    };
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setIsDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setIsDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      depth.current = 0;
      setIsDragging(false);
      void filesFromDataTransfer(event.dataTransfer!).then(onDrop);
    };
    window.addEventListener('dragenter', enter, true);
    window.addEventListener('dragover', over, true);
    window.addEventListener('dragleave', leave, true);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('dragenter', enter, true);
      window.removeEventListener('dragover', over, true);
      window.removeEventListener('dragleave', leave, true);
      window.removeEventListener('drop', drop, true);
    };
  }, [disabled, onDrop]);

  return isDragging;
}
