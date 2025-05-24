'use client';

import { FontFamily, Font } from '@/models/font.models';
import Link from 'next/link';

interface FontFamilyCardProps {
  family: FontFamily;
}

export default function FontFamilyCard({ family }: FontFamilyCardProps) {
  if (!family) return null;

  // Simple preview text - can be made dynamic later
  const previewText = family.name || 'AaBbCc';

  return (
    <div className="bg-white shadow-lg rounded-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
      <h2 className="text-2xl font-semibold mb-2 truncate" title={family.name}>
        {family.name}
      </h2>
      {family.metadata?.foundry && (
        <p className="text-sm text-gray-500 mb-1">By {family.metadata.foundry}</p>
      )}
      <p className="text-sm text-gray-600 mb-4">
        {family.fonts?.length || 0} style(s)
      </p>

      {/* Basic Preview - More advanced preview in later phases */}
      <div
        className="text-4xl mb-4 p-4 bg-gray-50 rounded break-words overflow-hidden"
        // In a real scenario, you'd use @font-face to apply the actual font here if available client-side
        // For Phase 1, we just show the name in a styled way.
        style={{ fontFamily: `'${family.name}', sans-serif` }}
        title={`Preview of ${family.name}`}
      >
        {previewText.substring(0, 30)}{previewText.length > 30 ? '...' : ''}
      </div>

      {family.fonts && family.fonts.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-md font-medium text-gray-700">Available Styles:</h4>
          <ul className="max-h-48 overflow-y-auto space-y-1">
            {family.fonts.map((font) => (
              <li key={font.id} className="flex justify-between items-center text-sm p-2 bg-gray-100 rounded hover:bg-gray-200">
                <span className="truncate" title={`${font.subfamily} (${font.format})`}>
                  {font.subfamily} <span className="text-xs text-gray-500">({font.format})</span>
                </span>
                <a
                  href={font.downloadUrl}
                  download={font.filename}
                  target="_blank" // Opens in new tab, browser handles download
                  rel="noopener noreferrer"
                  className="ml-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors disabled:bg-gray-300"
                  // title={`Download ${font.filename}`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(!family.fonts || family.fonts.length === 0) && (
        <p className="text-sm text-gray-500">No font styles available for download.</p>
      )}

      {/* Placeholder for link to family detail page - for later phases */}
      {/* <Link href={`/family/${family.id}`} className="mt-4 inline-block text-blue-600 hover:underline">
        View Details
      </Link> */}
    </div>
  );
}
