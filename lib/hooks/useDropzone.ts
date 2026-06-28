'use client';

import { useRef, useState } from 'react';
import { filesFromDataTransfer, filesFromInput, type WalkedFile } from '@/utils/walkDirectoryEntries';

interface UseDropzoneArgs {
  disabled?: boolean;
  onFilesWalked?: (walked: WalkedFile[]) => void;
  onFilesSelected?: (files: File[]) => void;
}

/** Drag/drop + file/folder input plumbing for the Dropzone component. */
export function useDropzone({ disabled, onFilesWalked, onFilesSelected }: UseDropzoneArgs) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const emitWalked = (walked: WalkedFile[]) => {
    if (walked.length === 0) return;
    if (onFilesWalked) onFilesWalked(walked);
    else onFilesSelected?.(walked.map((w) => w.file));
  };

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      emitWalked(await filesFromDataTransfer(e.dataTransfer));
    },
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files) emitWalked(filesFromInput(e.target.files));
  };

  return { isDragOver, fileInputRef, folderInputRef, dragProps, handleFileChange };
}
