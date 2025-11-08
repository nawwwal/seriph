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
  const numberOfStyles = family.fonts?.length || 0;

  return (
    <Link href={`/family/${family.id}`} className="block group h-full">
      <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-200 group-hover:shadow-xl group-hover:border-blue-500 transition-all duration-300 h-full flex flex-col overflow-hidden">
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-gray-800 truncate group-hover:text-blue-600 transition-colors" title={family.name}>
            {family.name}
          </h2>
          {family.metadata?.foundry && (
            <p className="text-sm text-gray-500">By {family.metadata.foundry}</p>
          )}
          {family.metadata?.people && family.metadata.people.length > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {family.metadata.people.filter(p => p.role === 'designer').map(p => p.name).join(', ')}
            </p>
          )}
          {((family.metadata?.moods?.length ?? 0) > 0 || (family.metadata?.useCases?.length ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap gap-1">
              {family.metadata?.moods?.slice(0, 2).map((mood, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">
                  {mood}
                </span>
              ))}
              {family.metadata?.useCases?.slice(0, 1).map((useCase, idx) => (
                <span key={idx} className="text-xs px-2 py-0.5 bg-blue-100 rounded text-blue-600">
                  {useCase}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="text-5xl mb-6 p-4 bg-gray-100 rounded-lg break-words overflow-hidden flex-grow flex items-center justify-center min-h-[120px] group-hover:bg-blue-50 transition-colors text-center leading-tight"
          style={{ fontFamily: `'${family.name}', sans-serif` }} // Still uses system font as placeholder
          title={`Preview of ${family.name}`}
        >
          {previewText.substring(0, 25)}{previewText.length > 25 ? '...' : ''}
        </div>

        <div className="mt-auto space-y-2 text-sm">
            <p className="font-semibold text-blue-600 bg-blue-100 px-3 py-1 rounded-full inline-block">
                {numberOfStyles} Style{numberOfStyles !== 1 ? 's' : ''} Available
            </p>
            {numberOfStyles > 0 && family.fonts && (
                <p className="text-xs text-gray-500 truncate" title={family.fonts.map(f => f.subfamily).join(', ')}>
                    Featuring: {family.fonts.map(f => f.subfamily).slice(0, 3).join(', ')}
                    {numberOfStyles > 3 ? ' and more...' : ''}
                </p>
            )}
        </div>

      </div>
    </Link>
  );
}
