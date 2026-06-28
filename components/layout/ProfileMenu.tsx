'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';

/** Avatar button + sign-out dropdown for a signed-in user. Self-contained state. */
export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setAvatarFailed(false), [user?.photoURL]);
  useEffect(() => setIsOpen(false), [user]);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex items-center justify-center w-8 h-8 rounded-full rule overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ink)] transition"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {user.photoURL && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="w-8 h-8 object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xs font-bold uppercase">
            {(user.displayName || 'U').charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-3 w-44 rounded-[var(--radius)] bg-[var(--paper)] rule shadow-lg overflow-hidden z-20">
          <div className="px-3 py-2 text-xs uppercase font-bold tracking-wide opacity-70">
            {user.displayName || user.email || 'Account'}
          </div>
          <button
            type="button"
            onClick={() => { setIsOpen(false); signOut(); }}
            className="w-full text-left uppercase font-bold text-sm px-3 py-2 btn-ink rule-t hover:ink-bg transition"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
