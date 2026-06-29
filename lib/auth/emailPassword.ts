import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
} from 'firebase/auth';
import { mapFirebaseAuthError, normalizeAuthEmail, validateEmailPassword } from '@/lib/auth/emailPasswordCore';
export { mapFirebaseAuthError, normalizeAuthEmail, validateEmailPassword } from '@/lib/auth/emailPasswordCore';

type EmailPasswordOperation = (email: string, password: string) => Promise<unknown>;
type ResetOperation = (email: string) => Promise<unknown>;

async function defaultSignIn(email: string, password: string): Promise<unknown> {
  const { auth } = await import('@/lib/firebase/auth');
  return firebaseSignInWithEmailAndPassword(auth, email, password);
}

async function defaultCreateAccount(email: string, password: string): Promise<unknown> {
  const { auth } = await import('@/lib/firebase/auth');
  return createUserWithEmailAndPassword(auth, email, password);
}

async function defaultSendReset(email: string): Promise<unknown> {
  const { auth } = await import('@/lib/firebase/auth');
  return sendPasswordResetEmail(auth, email);
}

export async function signInWithEmailPassword(params: {
  email: string;
  password: string;
  signIn?: EmailPasswordOperation;
}): Promise<void> {
  const validation = validateEmailPassword(params);
  if (!validation.ok) throw new Error(validation.message);

  try {
    await (params.signIn ?? defaultSignIn)(validation.email, validation.password);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

export async function createEmailPasswordAccount(params: {
  email: string;
  password: string;
  createAccount?: EmailPasswordOperation;
}): Promise<void> {
  const validation = validateEmailPassword(params);
  if (!validation.ok) throw new Error(validation.message);

  try {
    await (params.createAccount ?? defaultCreateAccount)(validation.email, validation.password);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}

export async function sendPasswordResetLink(params: {
  email: string;
  sendReset?: ResetOperation;
}): Promise<void> {
  const email = normalizeAuthEmail(params.email);
  if (!email) throw new Error('Enter an email address.');

  try {
    await (params.sendReset ?? defaultSendReset)(email);
  } catch (error) {
    throw new Error(mapFirebaseAuthError(error));
  }
}
