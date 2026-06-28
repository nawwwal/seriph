import { AlertTriangle, FileText } from 'lucide-react';
import { formatFileSize, type PreviewFamily } from '@/lib/upload/previewGrouping';

export default function PreviewFamilyCard({
  family,
  onRemoveFile,
}: {
  family: PreviewFamily;
  onRemoveFile?: (id: string) => void;
}) {
  return (
    <div className="rule p-4 rounded-[var(--radius)] bg-[var(--surface)]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-lg truncate" title={family.provisionalName}>{family.provisionalName}</h4>
          <div className="flex items-center gap-3 mt-1 text-xs uppercase opacity-70">
            <span><span className="font-bold">{family.files.length}</span> file{family.files.length !== 1 ? 's' : ''}</span>
            <span><span className="font-bold">{family.styles.size}</span> style{family.styles.size !== 1 ? 's' : ''}</span>
            <span className="font-bold">{formatFileSize(family.totalSize)}</span>
            {family.hasVariable && <span className="px-2 py-0.5 rule rounded-[var(--radius)] font-bold">Variable</span>}
          </div>
        </div>
      </div>

      {family.styles.size > 0 && (
        <div className="mb-3">
          <div className="text-xs uppercase font-bold opacity-70 mb-1">Styles</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(family.styles).map((style) => (
              <span key={style} className="text-xs px-2 py-1 rule rounded-[var(--radius)] btn-ink">{style}</span>
            ))}
          </div>
        </div>
      )}

      {family.conflicts.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 text-xs uppercase font-bold text-[var(--danger)] mb-1">
            <AlertTriangle size={14} />
            <span>Conflicts</span>
          </div>
          {family.conflicts.map((conflict, idx) => (
            <div key={idx} className="text-xs mb-1">
              <span className="font-bold">{conflict.style}:</span>{' '}
              <span className="opacity-70">{conflict.files.length} file{conflict.files.length !== 1 ? 's' : ''} with same style</span>
            </div>
          ))}
        </div>
      )}

      <div className="rule-t pt-3 mt-3">
        <div className="text-xs uppercase font-bold opacity-70 mb-2">Files</div>
        <div className="space-y-1">
          {family.files.map((file) => (
            <div key={file.id} className="flex items-center justify-between text-xs py-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText size={12} className="opacity-50 shrink-0" />
                <span className="truncate" title={file.file.name}>{file.file.name}</span>
                <span className="opacity-50 shrink-0">({formatFileSize(file.file.size)})</span>
              </div>
              {onRemoveFile && (
                <button
                  onClick={() => onRemoveFile(file.id)}
                  className="text-[var(--danger)] px-2 py-1 rounded hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] transition-colors"
                  aria-label={`Remove ${file.file.name}`}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-xs uppercase opacity-50">Formats: {Array.from(family.formats).join(', ')}</div>
    </div>
  );
}
