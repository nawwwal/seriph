declare global {
  interface Window {
    __seriphPendingFontFiles?: File[];
  }
}

/**
 * Store dropped fonts temporarily so the import page can consume them after navigation.
 */
export function storePendingFonts(files: File[]): void {
  if (typeof window === 'undefined' || files.length === 0) {
    return;
  }
  window.__seriphPendingFontFiles = files;
}

/**
 * Retrieve any pending fonts and clear the stash to avoid duplicate uploads.
 */
export function consumePendingFonts(): File[] | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const files = window.__seriphPendingFontFiles;
  delete window.__seriphPendingFontFiles;
  return files;
}
