'use client';

import { useRef, useState } from 'react';
import {
  filesFromDataTransfer,
  filesFromInput,
  type WalkedFile,
} from '@/utils/walkDirectoryEntries';

interface DropzoneProps {
  onFilesSelected?: (files: File[]) => void;
  /** Preferred for the upload journey: receives files with relative paths (folders/zip-aware). */
  onFilesWalked?: (walked: WalkedFile[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Show a "Choose folder" affordance (webkitdirectory) alongside file picking. */
  allowFolders?: boolean;
  /** Optional content rendered inside the drop area, above the drop prompt. */
  children?: React.ReactNode;
}

export default function Dropzone({
  onFilesSelected,
  onFilesWalked,
  accept = '.ttf,.otf,.woff,.woff2',
  multiple = true,
  disabled = false,
  allowFolders = false,
  children,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const emitWalked = (walked: WalkedFile[]) => {
    if (walked.length === 0) return;
    if (onFilesWalked) onFilesWalked(walked);
    else onFilesSelected?.(walked.map((w) => w.file));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    // Walk folder trees (and recover relative paths) when supported.
    const walked = await filesFromDataTransfer(e.dataTransfer);
    emitWalked(walked);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    if (e.target.files) emitWalked(filesFromInput(e.target.files));
  };

  return (
    <div
      className={`relative dashed-border rounded-[var(--radius)] p-8 sm:p-10 flex flex-col items-center justify-center text-center mx-auto group cursor-pointer transition-colors ${
        children ? 'max-w-5xl min-h-[420px]' : 'max-w-3xl min-h-[300px]'
      } ${isDragOver ? 'bg-[var(--muted)]' : ''} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      {allowFolders && (
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error non-standard but widely supported folder picker attrs
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
      )}
      {children && <div className="w-full mb-8">{children}</div>}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="80"
        height="80"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-6"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>
      <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight mb-4">
        Drop Fonts Here
      </div>
      <p className="mb-6 text-lg">
        {allowFolders
          ? 'Drag a folder or files (zips welcome) or click to browse'
          : 'Drag and drop font files or click to browse'}
      </p>
      {allowFolders && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) folderInputRef.current?.click();
          }}
          className="mb-6 uppercase text-sm font-bold rule px-4 py-2 rounded-[var(--radius)] btn-ink"
        >
          Choose folder
        </button>
      )}
      <p className="uppercase text-sm font-bold caret">
        {allowFolders ? 'TTF · OTF · WOFF · WOFF2 · ZIP · FOLDERS' : 'TTF, OTF, WOFF, WOFF2'}
      </p>
    </div>
  );
}

