'use client';

import CenteredShell from '@/components/layout/CenteredShell';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import LandingPage from '@/components/home/LandingPage';
import HomePageContent from '@/components/home/HomePageContent';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  if (authLoading) {
    return (
      <CenteredShell>
        <LoadingSpinner text="Loading Seriph..." size="large" />
      </CenteredShell>
    );
  }
  if (!user) return <LandingPage />;
  return <HomePageContent user={user} />;
}
