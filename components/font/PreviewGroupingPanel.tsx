'use client';

import { useMemo } from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { normalizeFamilyName, NORMALIZATION_SPEC_VERSION } from '@/utils/normalizationSpec';
import NormalizationSpecVersion from './NormalizationSpecVersion';
import type { ParseResult } from '@/lib/workers/font-parser.worker';

export interface PreviewFile {
  id: string;
  file: File;
  parseResult?: ParseResult;
  parseError?: string;
}

export interface PreviewFamily {
  normalizedName: string;
  provisionalName: string;
  files: PreviewFile[];
  styles: Set<string>;
  conflicts: Array<{ style: string; files: PreviewFile[] }>;
  hasVariable: boolean;
  totalSize: number;
  formats: Set<string>;
}

interface PreviewGroupingPanelProps {
  files: PreviewFile[];
  onRemoveFile?: (id: string) => void;
  serverSpecVersion?: string;
}

/**
 * Group files by normalized family name
 */
function groupFilesByFamily(files: PreviewFile[]): Map<string, PreviewFamily> {
  const families = new Map<string, PreviewFamily>();

  for (const file of files) {
    if (!file.parseResult?.success || !file.parseResult.provisionalFamily) {
      // Skip files that failed to parse
      continue;
    }

    const provisionalName = file.parseResult.provisionalFamily;
    const normalizedName = normalizeFamilyName(provisionalName);
    const subfamily = file.parseResult.subfamily || 'Regular';

    let family = families.get(normalizedName);
    if (!family) {
      family = {
        normalizedName,
        provisionalName,
        files: [],
        styles: new Set(),
        conflicts: [],
        hasVariable: false,
        totalSize: 0,
        formats: new Set(),
      };
      families.set(normalizedName, family);
    }

    // Add file to family
    family.files.push(file);
    family.totalSize += file.file.size;

    // Add format
    const ext = file.file.name.split('.').pop()?.toLowerCase() || '';
    family.formats.add(ext.toUpperCase());

    // Check for variable font
    if (file.parseResult.isVariable) {
      family.hasVariable = true;
    }

    // Check for style conflicts
    const existingStyleFiles = family.files.filter(
      (f) => f.parseResult?.subfamily === subfamily && f.id !== file.id
    );

    if (existingStyleFiles.length > 0) {
      // Conflict detected
      const conflict = family.conflicts.find((c) => c.style === subfamily);
      if (conflict) {
        conflict.files.push(file);
      } else {
        family.conflicts.push({
          style: subfamily,
          files: [file, ...existingStyleFiles],
        });
      }
    } else {
      family.styles.add(subfamily);
    }
  }

  return families;
}

export default function PreviewGroupingPanel({
  files,
  onRemoveFile,
  serverSpecVersion,
}: PreviewGroupingPanelProps) {
  const families = useMemo(() => {
    return Array.from(groupFilesByFamily(files).values());
  }, [files]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (families.length === 0) {
    return (
      <div className="rule p-4 rounded-[var(--radius)] bg-[var(--surface)]">
        <p className="text-sm opacity-70">No families detected yet. Parsing fonts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rule-b pb-2">
        <h3 className="uppercase font-bold text-sm">Preview Grouping</h3>
        <span className="uppercase text-xs font-bold opacity-70 px-2 py-1 rule rounded-[var(--radius)]">
          Provisional
        </span>
      </div>

      {serverSpecVersion && (
        <NormalizationSpecVersion
          clientVersion={NORMALIZATION_SPEC_VERSION}
          serverVersion={serverSpecVersion}
        />
      )}

      <div className="space-y-3">
        {families.map((family) => (
          <div
            key={family.normalizedName}
            className="rule p-4 rounded-[var(--radius)] bg-[var(--surface)]"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-lg truncate" title={family.provisionalName}>
                  {family.provisionalName}
                </h4>
                <div className="flex items-center gap-3 mt-1 text-xs uppercase opacity-70">
                  <span>
                    <span className="font-bold">{family.files.length}</span> file
                    {family.files.length !== 1 ? 's' : ''}
                  </span>
                  <span>
                    <span className="font-bold">{family.styles.size}</span> style
                    {family.styles.size !== 1 ? 's' : ''}
                  </span>
                  <span className="font-bold">{formatFileSize(family.totalSize)}</span>
                  {family.hasVariable && (
                    <span className="px-2 py-0.5 rule rounded-[var(--radius)] font-bold">
                      Variable
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Detected styles */}
            {family.styles.size > 0 && (
              <div className="mb-3">
                <div className="text-xs uppercase font-bold opacity-70 mb-1">Styles</div>
                <div className="flex flex-wrap gap-1">
                  {Array.from(family.styles).map((style) => (
                    <span
                      key={style}
                      className="text-xs px-2 py-1 rule rounded-[var(--radius)] btn-ink"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts */}
            {family.conflicts.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 text-xs uppercase font-bold text-red-600 mb-1">
                  <AlertTriangle size={14} />
                  <span>Conflicts</span>
                </div>
                {family.conflicts.map((conflict, idx) => (
                  <div key={idx} className="text-xs mb-1">
                    <span className="font-bold">{conflict.style}:</span>{' '}
                    <span className="opacity-70">
                      {conflict.files.length} file{conflict.files.length !== 1 ? 's' : ''} with
                      same style
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* File list */}
            <div className="rule-t pt-3 mt-3">
              <div className="text-xs uppercase font-bold opacity-70 mb-2">Files</div>
              <div className="space-y-1">
                {family.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between text-xs py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText size={12} className="opacity-50 shrink-0" />
                      <span className="truncate" title={file.file.name}>
                        {file.file.name}
                      </span>
                      <span className="opacity-50 shrink-0">
                        ({formatFileSize(file.file.size)})
                      </span>
                    </div>
                    {onRemoveFile && (
                      <button
                        onClick={() => onRemoveFile(file.id)}
                        className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        aria-label={`Remove ${file.file.name}`}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Formats */}
            <div className="mt-2 text-xs uppercase opacity-50">
              Formats: {Array.from(family.formats).join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

