'use client';

import { type WalkedFile } from '@/utils/walkDirectoryEntries';
import { useDropzone } from '@/lib/hooks/useDropzone';
import { Button } from './Button';
import UploadIcon from './UploadIcon';

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
  const { isDragOver, fileInputRef, folderInputRef, dragProps, handleFileChange } = useDropzone({
    disabled,
    onFilesWalked,
    onFilesSelected,
  });

  return (
    <div
      className={`relative dashed-border rounded-[var(--radius)] p-8 sm:p-10 flex flex-col items-center justify-center text-center mx-auto group cursor-pointer transition-colors ${
        children ? 'max-w-5xl min-h-[420px]' : 'max-w-3xl min-h-[300px]'
      } ${isDragOver ? 'bg-[var(--muted)]' : ''} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      {...dragProps}
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
      <UploadIcon className="mb-6" />
      <div className="uppercase font-extrabold text-2xl sm:text-3xl md:text-4xl cap-tight mb-4">
        Drop Fonts Here
      </div>
      <p className="mb-6 text-lg">
        {allowFolders
          ? 'Drag a folder or files (zips welcome) or click to browse'
          : 'Drag and drop font files or click to browse'}
      </p>
      {allowFolders && (
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) folderInputRef.current?.click();
          }}
          className="mb-6"
          size="mdText"
        >
          Choose folder
        </Button>
      )}
      <p className="uppercase text-sm font-bold caret">
        {allowFolders ? 'TTF · OTF · WOFF · WOFF2 · ZIP · FOLDERS' : 'TTF, OTF, WOFF, WOFF2'}
      </p>
    </div>
  );
}
