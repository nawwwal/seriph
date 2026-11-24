'use client';

import { Button } from '@/components/ui/Button';

export default function WelcomeState({ onImport }: { onImport: () => void }) {
  return (
    <main className="flex h-full min-h-[50vh] items-center justify-center p-6">
      <div className="rule max-w-md rounded-[var(--radius)] p-8 text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">Drop your fonts</h2>
        <p className="mt-2 text-sm opacity-70">Files, folders, or ZIPs.</p>
        <Button type="button" onClick={onImport} size="mdText" tone="solid" className="mt-5">
          Import fonts
        </Button>
      </div>
    </main>
  );
}
