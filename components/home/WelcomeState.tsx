'use client';

import Dropzone from '@/components/ui/Dropzone';

interface WelcomeStateProps {
  onFilesSelected: (files: File[]) => void;
}

export default function WelcomeState({ onFilesSelected }: WelcomeStateProps) {
  return (
    <main className="mt-6 sm:mt-8 md:mt-10">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
          Welcome to Your Seriph
        </h2>
        <p className="mt-3 max-w-2xl mx-auto text-lg">
          Your personal font library is empty. Let&apos;s get started by adding some fonts.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
        <div className="flex flex-col items-center text-center p-6 rule rounded-[var(--radius)]">
          <div className="step-number">1</div>
          <h3 className="text-xl font-bold mt-4 mb-2">Upload Fonts</h3>
          <p className="mb-4">
            Click &quot;Add Fonts&quot; or drag and drop font files into the dropzone below.
          </p>
          <div className="mt-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center text-center p-6 rule rounded-[var(--radius)]">
          <div className="step-number">2</div>
          <h3 className="text-xl font-bold mt-4 mb-2">Organize Automatically</h3>
          <p className="mb-4">Fonts are grouped into families with custom generated covers.</p>
          <div className="mt-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="9" x2="20" y2="9"></line>
              <line x1="4" y1="15" x2="20" y2="15"></line>
              <line x1="10" y1="3" x2="8" y2="21"></line>
              <line x1="16" y1="3" x2="14" y2="21"></line>
            </svg>
          </div>
        </div>

        <div className="flex flex-col items-center text-center p-6 rule rounded-[var(--radius)]">
          <div className="step-number">3</div>
          <h3 className="text-xl font-bold mt-4 mb-2">Browse Your Collection</h3>
          <p className="mb-4">Switch between spines and covers view to explore your library.</p>
          <div className="mt-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
        </div>
      </div>

      <Dropzone onFilesSelected={onFilesSelected} />

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

