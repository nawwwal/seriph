'use client';

import { FormEvent, useState } from 'react';
import { LogIn, Mail, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { AuthFields, AuthModeFooter, type AuthMode } from './AuthFormParts';

const modeText: Record<AuthMode, { title: string; submit: string; icon: typeof LogIn }> = {
  'sign-in': { title: 'Sign in', submit: 'Sign in', icon: LogIn },
  'create-account': { title: 'Create account', submit: 'Create account', icon: UserPlus },
  'reset-password': { title: 'Reset password', submit: 'Send reset link', icon: Mail },
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Try again.';
}

export default function AuthForm() {
  const router = useRouter();
  const {
    signInWithEmailPassword,
    createAccountWithEmailPassword,
    sendPasswordReset,
    isLoading: authLoading,
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const current = modeText[mode];
  const SubmitIcon = current.icon;

  const setAuthMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    try {
      if (mode === 'reset-password') {
        await sendPasswordReset(email);
        setNotice('Check your email for a reset link.');
      } else if (mode === 'create-account') {
        await createAccountWithEmailPassword(email, password);
        router.replace('/');
      } else {
        await signInWithEmailPassword(email, password);
        router.replace('/');
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md rule rounded-[var(--radius)] bg-[var(--paper)]">
      <div className="rule-b px-5 py-4">
        <h1 className="uppercase font-black tracking-tight text-3xl cap-tight">{current.title}</h1>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <AuthFields mode={mode} email={email} password={password} error={error} notice={notice} pending={pending} authLoading={authLoading} submitText={current.submit} SubmitIcon={SubmitIcon} setEmail={setEmail} setPassword={setPassword} />
      </form>
      <AuthModeFooter mode={mode} setMode={setAuthMode} />
    </div>
  );
}
