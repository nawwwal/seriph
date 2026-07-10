'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '@/components/auth/AuthForm';
import LoadingSplash from '@/components/ui/LoadingSplash';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace('/');
  }, [isLoading, router, user]);

  if (isLoading || user) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <LoadingSplash text="Loading Seriph..." />
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center p-8 sm:p-10 md:p-12 lg:p-16">
      <AuthForm />
    </main>
  );
}
