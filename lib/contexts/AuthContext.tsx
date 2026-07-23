'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import {
  createEmailPasswordAccount,
  sendPasswordResetLink,
  signInWithEmailPassword as signInWithEmailPasswordHelper,
} from '@/lib/auth/emailPassword';
import { auth } from '@/lib/firebase/auth';
import { clearAccountSnapshots } from '@/lib/cache/persistentSnapshots';
import { clearFamilyDetailNegativeCacheForUser } from '@/lib/cache/familyDetailClient';
import { clearFamilyCacheForUser } from '@/lib/cache/familyCache';
import { clearFamilyPreviewCacheForUser } from '@/lib/cache/familyPreviewCache';
import { clearSearchIndexCache } from '@/lib/search/searchIndexCache';
import { clearShelfFamilyCache } from '@/lib/shelf/familyPageCache';

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  createAccountWithEmailPassword: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmailPassword = useCallback(async (email: string, password: string) => {
    await signInWithEmailPasswordHelper({ email, password });
  }, []);

  const createAccountWithEmailPassword = useCallback(async (email: string, password: string) => {
    await createEmailPasswordAccount({ email, password });
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetLink({ email });
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      clearFamilyDetailNegativeCacheForUser(user.uid);
      clearFamilyCacheForUser(user.uid);
      clearFamilyPreviewCacheForUser(user.uid);
      clearSearchIndexCache(user.uid);
      clearShelfFamilyCache(user.uid);
      try {
        await clearAccountSnapshots({ accountId: user.uid });
      } catch (error) {
        console.error('Failed to clear persistent snapshots during sign-out:', error);
      }
    }
    await firebaseSignOut(auth);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      signInWithEmailPassword,
      createAccountWithEmailPassword,
      sendPasswordReset,
      signOut,
    }),
    [user, isLoading, signInWithEmailPassword, createAccountWithEmailPassword, sendPasswordReset, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
