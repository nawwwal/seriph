import { describe, expect, it, vi } from 'vitest';
import {
  createEmailPasswordAccount,
  mapFirebaseAuthError,
  normalizeAuthEmail,
  sendPasswordResetLink,
  validateEmailPassword,
} from '@/lib/auth/emailPassword';

describe('email/password auth helpers', () => {
  it('trims and lowercases email addresses before Firebase calls', async () => {
    const createAccount = vi.fn().mockResolvedValue(undefined);

    await createEmailPasswordAccount({
      email: '  ADA@SERIPH.TEST  ',
      password: 'correct horse',
      createAccount,
    });

    expect(normalizeAuthEmail('  ADA@SERIPH.TEST  ')).toBe('ada@seriph.test');
    expect(createAccount).toHaveBeenCalledWith('ada@seriph.test', 'correct horse');
  });

  it('requires a non-empty email and at least eight password characters', () => {
    expect(validateEmailPassword({ email: '', password: 'long-enough' })).toEqual({
      ok: false,
      message: 'Enter an email address.',
    });
    expect(validateEmailPassword({ email: 'ada@seriph.test', password: 'short' })).toEqual({
      ok: false,
      message: 'Use at least 8 characters for the password.',
    });
    expect(validateEmailPassword({ email: 'ada@seriph.test', password: 'long-enough' })).toEqual({
      ok: true,
      email: 'ada@seriph.test',
      password: 'long-enough',
    });
  });

  it('validates reset requests before sending a Firebase password email', async () => {
    const sendReset = vi.fn().mockResolvedValue(undefined);

    await expect(sendPasswordResetLink({ email: ' ', sendReset })).rejects.toThrow('Enter an email address.');

    expect(sendReset).not.toHaveBeenCalled();
  });

  it('maps Firebase auth errors to Seriph copy', () => {
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' })).toBe('Email or password is not right.');
    expect(mapFirebaseAuthError({ code: 'auth/email-already-in-use' })).toBe('An account already exists for that email.');
    expect(mapFirebaseAuthError({ code: 'auth/weak-password' })).toBe('Use at least 8 characters for the password.');
    expect(mapFirebaseAuthError({ code: 'auth/too-many-requests' })).toBe('Too many attempts. Wait a moment and try again.');
    expect(mapFirebaseAuthError(new Error('network broke'))).toBe('network broke');
  });
});
