/** Classify catalogue ↔ detail navigations for depth handoff. */

export type WorkspaceNav = 'forward' | 'back' | 'cross';

export function isFamilyPath(pathname: string): boolean {
  return pathname === '/family' || pathname.startsWith('/family/');
}

export function isCatalogPath(pathname: string): boolean {
  return pathname === '/' || pathname === '';
}

/** Direction of a pathname change for shell depth animation. */
export function workspaceNavDirection(
  fromPath: string,
  toPath: string,
): WorkspaceNav {
  if (fromPath === toPath) return 'cross';
  if (isCatalogPath(fromPath) && isFamilyPath(toPath)) return 'forward';
  if (isFamilyPath(fromPath) && isCatalogPath(toPath)) return 'back';
  return 'cross';
}
