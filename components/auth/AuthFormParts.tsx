'use client';

import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';

export type AuthMode = 'sign-in' | 'create-account' | 'reset-password';

interface AuthFieldsProps {
  mode: AuthMode;
  email: string;
  password: string;
  error: string | null;
  notice: string | null;
  pending: boolean;
  authLoading: boolean;
  submitText: string;
  SubmitIcon: LucideIcon;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
}

export function AuthFields(props: AuthFieldsProps) {
  const needsPassword = props.mode !== 'reset-password';
  const SubmitIcon = props.SubmitIcon;
  return (
    <>
      <label className="block">
        <span className="block uppercase text-xs font-bold opacity-70 mb-2">Email</span>
        <TextInput
          type="email"
          value={props.email}
          onChange={(event) => props.setEmail(event.target.value)}
          autoComplete="email"
          size="form"
          required
        />
      </label>
      {needsPassword && (
        <label className="block">
          <span className="block uppercase text-xs font-bold opacity-70 mb-2">Password</span>
          <TextInput
            type="password"
            value={props.password}
            onChange={(event) => props.setPassword(event.target.value)}
            autoComplete={props.mode === 'create-account' ? 'new-password' : 'current-password'}
            size="form"
            required
            minLength={8}
          />
        </label>
      )}
      {props.error && <p className="rule px-3 py-2 text-sm font-bold text-[var(--danger)]" role="alert">{props.error}</p>}
      {props.notice && <p className="rule px-3 py-2 text-sm font-bold text-[var(--success)]" role="status">{props.notice}</p>}
      <Button
        type="submit"
        disabled={props.pending || props.authLoading}
        className="disabled:opacity-50"
        icon={<SubmitIcon size={16} aria-hidden="true" />}
        size="authSubmit"
        tone="solid"
      >
        {props.pending ? 'Working' : props.submitText}
      </Button>
    </>
  );
}

export function AuthModeFooter({ mode, setMode }: { mode: AuthMode; setMode: (mode: AuthMode) => void }) {
  return (
    <div className="rule-t p-3 flex flex-col gap-2">
      {mode === 'sign-in' ? (
        <>
          <Button type="button" onClick={() => setMode('create-account')} className="text-left" size="text">Create account</Button>
          <Button type="button" onClick={() => setMode('reset-password')} className="text-left" size="text">Forgot password</Button>
        </>
      ) : (
        <Button type="button" onClick={() => setMode('sign-in')} className="text-left" icon={<ArrowLeft size={15} aria-hidden="true" />} size="textIcon">
          Back to sign in
        </Button>
      )}
    </div>
  );
}
