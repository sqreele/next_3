// app/lib/hooks/useAuth.ts
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ERROR_TYPES, ROUTES } from '../config';

export function useAuth() {
  const session: any = null; const status = 'unauthenticated' as const;
  const router = useRouter();

  useEffect(() => {
    // Handle session errors
    if (session?.error) {
      console.error('Session error detected:', session.error);
      
      // Force sign out and redirect to error page
      router.push(`${ROUTES.error}?error=${session.error}`);
    }
  }, [session?.error, router]);

  // Check if user is authenticated
  const isAuthenticated = status === 'authenticated' && session?.user && !session?.error;
  
  // Check if authentication is loading
  const isLoading = status === 'loading';
  
  // Check if user is not authenticated
  const isUnauthenticated = status === 'unauthenticated';

  // Get user data safely
  const user = isAuthenticated ? session.user : null;

  // Check if access token is available
  const hasValidToken = isAuthenticated && user?.accessToken;

  return {
    session,
    status,
    user,
    isAuthenticated,
    isLoading,
    isUnauthenticated,
    hasValidToken,
    error: session?.error,
  };
}

// Hook for components that require authentication
export function useRequireAuth() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isUnauthenticated) {
      router.push(ROUTES.signIn);
    }
  }, [auth.isUnauthenticated, router]);

  return auth;
}

// Hook for components that should redirect if authenticated
export function useRedirectIfAuthenticated() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.isAuthenticated) {
      router.push(ROUTES.dashboard);
    }
  }, [auth.isAuthenticated, router]);

  return auth;
} 