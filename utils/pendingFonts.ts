declare global {
  interface Window {
    __seriphPendingFontFiles?: { uid: string; files: File[] };
  }
}

/**
 * Store dropped fonts temporarily so the import page can consume them after navigation.
 */
export function storePendingFonts(files: File[], uid: string): void {
  if (typeof window === 'undefined' || files.length === 0) {
    return;
  }
  window.__seriphPendingFontFiles = { uid, files };
}

/**
 * Retrieve any pending fonts and clear the stash to avoid duplicate uploads.
 */
export function consumePendingFonts(uid: string): File[] | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const pending = window.__seriphPendingFontFiles;
  delete window.__seriphPendingFontFiles;
  return pending?.uid === uid ? pending.files : undefined;
}
