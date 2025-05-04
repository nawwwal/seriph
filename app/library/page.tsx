import { LibraryControls } from "@/components/library/library-controls";
import { FontGrid } from "@/components/library/font-grid";
import { DownloadBar } from "@/components/library/download-bar";

export default function LibraryPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Font Library</h1>
        <p className="text-muted-foreground">
          Browse, filter, and manage your collection of fonts.
        </p>
      </div>
      
      <LibraryControls />
      
      <FontGrid />
      
      <DownloadBar />
    </div>
  );
}