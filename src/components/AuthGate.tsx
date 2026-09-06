'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Logo } from '@/components/Logo';

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading, openAuthModal } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to public landing page with redirect parameter and trigger login modal
      const redirectUrl = `/?redirect=${encodeURIComponent(pathname || '/')}&auth=login`;
      router.replace(redirectUrl);
      openAuthModal('login');
    }
  }, [loading, user, router, pathname, openAuthModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-page)] flex flex-col items-center justify-center space-y-4">
        <div className="animate-pulse">
          <Logo size="lg" />
        </div>
        <div className="w-6 h-6 border-2 border-[var(--color-coral)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

export default AuthGate;
