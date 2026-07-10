/** A vertically/horizontally centered content area for loading and error states. */
export default function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen flex-1 min-h-0 flex items-center justify-center p-8 bg-[var(--paper)]">
      {children}
    </div>
  );
}
