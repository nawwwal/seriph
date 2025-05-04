import { UploadContainer } from "@/components/upload/upload-container";
import { UploadStatus } from "@/components/upload/upload-status";

export default function UploadPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Upload Fonts</h1>
        <p className="text-muted-foreground">
          Drag and drop font files to add them to your collection.
        </p>
      </div>
      
      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UploadContainer />
        </div>
        <div>
          <UploadStatus />
        </div>
      </div>
    </div>
  );
}