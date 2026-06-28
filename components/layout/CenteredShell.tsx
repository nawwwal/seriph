import NavBar from './NavBar';

/** NavBar + a vertically/horizontally centered content area (loading/error states). */
export default function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen flex flex-col bg-[var(--paper)]">
      <NavBar />
      <div className="flex-1 flex items-center justify-center p-8">{children}</div>
    </div>
  );
}
