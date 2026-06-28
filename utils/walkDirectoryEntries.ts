/**
 * Walk a dropped folder tree into a flat list of files, preserving each file's
 * relative path. Uses the (non-standard but widely supported) entries API so a
 * user can drop a whole folder and we recover everything inside it.
 *
 * Each returned file carries a `relativePath` property (best-effort).
 */
export interface WalkedFile {
  file: File;
  relativePath: string;
}

function readEntries(reader: any): Promise<any[]> {
  return new Promise((resolve, reject) => {
    reader.readEntries((entries: any[]) => resolve(entries), reject);
  });
}

async function walkEntry(entry: any, prefix: string, out: WalkedFile[]): Promise<void> {
  if (!entry) return;
  if (entry.isFile) {
    const file: File = await new Promise((resolve, reject) => entry.file(resolve, reject));
    out.push({ file, relativePath: prefix ? `${prefix}/${file.name}` : file.name });
    return;
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    // readEntries returns in batches; keep reading until empty.
    let batch = await readEntries(reader);
    while (batch.length > 0) {
      for (const child of batch) {
        await walkEntry(child, prefix ? `${prefix}/${entry.name}` : entry.name, out);
      }
      batch = await readEntries(reader);
    }
  }
}

/**
 * Extract all files (recursively) from a drop event's DataTransfer. Falls back to
 * the flat `dataTransfer.files` list when the entries API is unavailable.
 */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<WalkedFile[]> {
  const items = dt.items;
  const supportsEntries =
    items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === "function";

  if (!supportsEntries) {
    return Array.from(dt.files).map((file) => ({
      file,
      relativePath: (file as any).webkitRelativePath || file.name,
    }));
  }

  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = (items[i] as any).webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }

  const out: WalkedFile[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, "", out)));
  return out;
}

/** Map a `<input webkitdirectory>` FileList into WalkedFile[] using webkitRelativePath. */
export function filesFromInput(fileList: FileList | File[]): WalkedFile[] {
  return Array.from(fileList).map((file) => ({
    file,
    relativePath: (file as any).webkitRelativePath || file.name,
  }));
}
