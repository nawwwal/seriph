'use client';

import { ArrowLeft, type LucideIcon } from 'lucide-react';

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
        <input
          type="email"
          value={props.email}
          onChange={(event) => props.setEmail(event.target.value)}
          autoComplete="email"
          className="w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
          required
        />
      </label>
      {needsPassword && (
        <label className="block">
          <span className="block uppercase text-xs font-bold opacity-70 mb-2">Password</span>
          <input
            type="password"
            value={props.password}
            onChange={(event) => props.setPassword(event.target.value)}
            autoComplete={props.mode === 'create-account' ? 'new-password' : 'current-password'}
            className="w-full rule rounded-[var(--radius)] bg-[var(--paper)] px-3 py-2 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
            required
            minLength={8}
          />
        </label>
      )}
      {props.error && <p className="rule px-3 py-2 text-sm font-bold text-[var(--danger)]" role="alert">{props.error}</p>}
      {props.notice && <p className="rule px-3 py-2 text-sm font-bold text-[var(--success)]" role="status">{props.notice}</p>}
      <button
        type="submit"
        disabled={props.pending || props.authLoading}
        className="inline-flex w-full h-11 items-center justify-center gap-2 uppercase font-bold rule rounded-[var(--radius)] text-sm btn-ink ink-bg disabled:opacity-50"
      >
        <SubmitIcon size={16} aria-hidden="true" />
        {props.pending ? 'Working' : props.submitText}
      </button>
    </>
  );
}

export function AuthModeFooter({ mode, setMode }: { mode: AuthMode; setMode: (mode: AuthMode) => void }) {
  return (
    <div className="rule-t p-3 flex flex-col gap-2">
      {mode === 'sign-in' ? (
        <>
          <button type="button" onClick={() => setMode('create-account')} className="uppercase font-bold text-sm px-2 py-1 btn-ink text-left">Create account</button>
          <button type="button" onClick={() => setMode('reset-password')} className="uppercase font-bold text-sm px-2 py-1 btn-ink text-left">Forgot password</button>
        </>
      ) : (
        <button type="button" onClick={() => setMode('sign-in')} className="inline-flex items-center gap-2 uppercase font-bold text-sm px-2 py-1 btn-ink text-left">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to sign in
        </button>
      )}
    </div>
  );
}
