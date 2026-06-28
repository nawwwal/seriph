'use client';

import { useState, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';

/** Drag/drop + file picker surface for the modal uploader (self-contained drag state). */
export default function UploadDropArea({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);

  const stop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  return (
    <div
      onDragEnter={(e) => { stop(e); setIsDragging(true); }}
      onDragLeave={(e) => { stop(e); setIsDragging(false); }}
      onDragOver={stop}
      onDrop={(e) => {
        stop(e);
        setIsDragging(false);
        if (e.dataTransfer.files?.length) {
          onFiles(Array.from(e.dataTransfer.files));
          e.dataTransfer.clearData();
        }
      }}
      className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
        isDragging ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--info)_12%,transparent)]' : 'border-[var(--muted)] hover:border-[var(--ink)]'
      }`}
    >
      <UploadCloud className={`mx-auto mb-3 ${isDragging ? 'text-[var(--info)]' : 'opacity-70'}`} size={48} />
      <p className="mb-2 opacity-70">Drag &amp; drop your font files here (TTF, OTF, WOFF, WOFF2, EOT)</p>
      <p className="text-sm opacity-70 mb-3">or</p>
      <input type="file" id="modal-font-upload" multiple onChange={onChange} accept=".ttf,.otf,.woff,.woff2,.eot" className="hidden" />
      <label htmlFor="modal-font-upload" className="cursor-pointer px-6 py-2.5 bg-[var(--accent)] text-[var(--paper)] rounded-md hover:opacity-90 transition-colors text-sm font-medium">
        Choose Files
      </label>
      {isDragging && <p className="mt-3 text-[var(--info)] font-semibold">Release to drop files</p>}
    </div>
  );
}
