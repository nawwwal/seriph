/**
 * Remembers last AppShell geometry so the next route can tween from it.
 * Framer layoutId helps; this snapshot drives initial→animate on remount.
 */

export type ShellSnap = {
  compact: boolean;
  railOpen: boolean;
};

let snap: ShellSnap | null = null;

/** Read last committed shell (do not clear — multiple children may peek). */
export function peekShellSnap(): ShellSnap | null {
  return snap;
}

/** Call after paint when current shell is the source of truth. */
export function commitShellSnap(next: ShellSnap): void {
  snap = next;
}

/** True when navigation changed shell geometry. */
export function shellGeometryChanged(
  from: ShellSnap | null,
  to: ShellSnap,
): boolean {
  if (!from) return false;
  return from.compact !== to.compact || from.railOpen !== to.railOpen;
}
