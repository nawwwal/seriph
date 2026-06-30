'use client';

import { Menu } from '@base-ui/react/menu';
import { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { buttonClassName } from '@/components/ui/buttonStyles';

/** Avatar button + sign-out dropdown for a signed-in user. Self-contained state. */
export default function ProfileMenu() {
  const { user, signOut } = useAuth();
  const [openForUserId, setOpenForUserId] = useState<string | null>(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const userId = user?.uid ?? null;
  const avatarUrl = user?.photoURL ?? null;
  const isOpen = openForUserId === userId;
  const avatarFailed = avatarUrl !== null && failedAvatarUrl === avatarUrl;

  if (!user) return null;

  return (
    <Menu.Root
      open={isOpen}
      onOpenChange={(open) => setOpenForUserId(open ? user.uid : null)}
      modal={false}
    >
      <Menu.Trigger
        type="button"
        className={buttonClassName({ size: 'avatar', tone: 'plain' })}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {avatarUrl && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={user.displayName || 'User'}
            width={32}
            height={32}
            referrerPolicy="no-referrer"
            onError={() => setFailedAvatarUrl(avatarUrl)}
            className="w-8 h-8 object-cover"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-xs font-bold uppercase">
            {(user.displayName || 'U').charAt(0).toUpperCase()}
          </span>
        )}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={12} className="z-20">
          <Menu.Popup className="w-44 rounded-[var(--radius)] bg-[var(--paper)] rule theme-shadow-lg overflow-hidden z-20">
            <div className="px-3 py-2 text-xs uppercase font-bold tracking-wide opacity-70">
              {user.displayName || user.email || 'Account'}
            </div>
            <Menu.Item
              onClick={() => { setOpenForUserId(null); signOut(); }}
              className={buttonClassName({ size: 'profileMenuItem' })}
            >
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
