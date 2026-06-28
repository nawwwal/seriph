'use client';

import Dropzone from '@/components/ui/Dropzone';
import WelcomeSteps from './WelcomeSteps';

interface WelcomeStateProps {
  onFilesSelected: (files: File[]) => void;
}

export default function WelcomeState({ onFilesSelected }: WelcomeStateProps) {
  return (
    <main className="mt-6 sm:mt-8 md:mt-10">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
          Your shelf is empty
        </h2>
        <p className="mt-3 max-w-2xl mx-auto text-lg">
          Drop in your font files and Seriph turns the pile into a library you can see and search.
        </p>
      </div>

      <Dropzone onFilesSelected={onFilesSelected}>
        <WelcomeSteps />
      </Dropzone>

      <div className="mt-12 max-w-3xl mx-auto">
        <h3 className="uppercase font-bold text-lg mb-4">Supported Font Formats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { ext: '.TTF', name: 'TrueType Font' },
            { ext: '.OTF', name: 'OpenType Font' },
            { ext: '.WOFF', name: 'Web Open Font' },
            { ext: '.WOFF2', name: 'Web Open Font 2' },
          ].map((format, idx) => (
            <div key={idx} className="p-4 rule rounded-[var(--radius)] text-center">
              <div className="text-2xl font-bold mb-1">{format.ext}</div>
              <div className="text-sm">{format.name}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

