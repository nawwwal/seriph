const MIN_PASSWORD_LENGTH = 8;

export type EmailPasswordValidation =
  | { ok: true; email: string; password: string }
  | { ok: false; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  return typeof error.code === 'string' ? error.code : null;
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmailPassword(params: { email: string; password: string }): EmailPasswordValidation {
  const email = normalizeAuthEmail(params.email);
  if (!email) return { ok: false, message: 'Enter an email address.' };
  if (params.password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: 'Use at least 8 characters for the password.' };
  }
  return { ok: true, email, password: params.password };
}

export function mapFirebaseAuthError(error: unknown): string {
  switch (errorCode(error)) {
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is not right.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email.';
    case 'auth/weak-password':
      return 'Use at least 8 characters for the password.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network trouble. Check your connection and try again.';
    case 'auth/permission-denied':
    case 'permission-denied':
      return 'Seriph is in closed beta. This email is not on the invite list.';
    default:
      return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.';
  }
}
