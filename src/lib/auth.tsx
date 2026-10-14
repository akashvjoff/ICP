import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, formatSupabaseError, DEFAULT_DEMO_USER, WorkspaceUser } from './supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  workspaceUser: WorkspaceUser;
  loading: boolean;
  isConfigured: boolean;
  isDemoUser: boolean;
  authError: string | null;
  clearError: () => void;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, metadata?: { full_name?: string; company_name?: string }) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  resendVerification: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (profile: { name: string; email: string; company: string; role: string }) => Promise<{ success: boolean; error?: string; emailConfirmationPending?: boolean }>;
  switchToDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDemoUser, setIsDemoUser] = useState<boolean>(!isSupabaseConfigured);

  // Derive workspace user profile
  const workspaceUser: WorkspaceUser = user
    ? {
        id: user.id,
        email: user.email || '',
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Member',
        role: user.user_metadata?.gtm_role || 'Founder',
        isDemoUser: false,
      }
    : DEFAULT_DEMO_USER;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('Initial Supabase session fetch warning:', error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setIsDemoUser(false);
      }
      setLoading(false);
    });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        setIsDemoUser(false);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const clearError = () => setAuthError(null);

  const signIn = async (email: string, password: string) => {
    clearError();
    if (!supabase) {
      // Offline / Demo fallback
      setIsDemoUser(true);
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const friendlyMsg = formatSupabaseError(error);
        setAuthError(friendlyMsg);
        return { success: false, error: friendlyMsg };
      }

      setSession(data.session);
      setUser(data.user);
      setIsDemoUser(false);
      return { success: true };
    } catch (err) {
      const friendlyMsg = formatSupabaseError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signInWithGoogle = async () => {
    clearError();
    if (!supabase) {
      return { success: false, error: 'Google sign-in requires the live Supabase workspace.' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        const friendlyMsg = formatSupabaseError(error);
        setAuthError(friendlyMsg);
        return { success: false, error: friendlyMsg };
      }
      return { success: true };
    } catch (err) {
      const friendlyMsg = formatSupabaseError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { full_name?: string; company_name?: string }
  ) => {
    clearError();
    if (!supabase) {
      setIsDemoUser(true);
      return { success: true };
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            full_name: metadata?.full_name || '',
            company_name: metadata?.company_name || '',
          },
        },
      });

      if (error) {
        const friendlyMsg = formatSupabaseError(error);
        setAuthError(friendlyMsg);
        return { success: false, error: friendlyMsg };
      }

      const requiresConfirmation = !data.session;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        setIsDemoUser(false);
      }

      return {
        success: true,
        requiresEmailConfirmation: requiresConfirmation,
      };
    } catch (err) {
      const friendlyMsg = formatSupabaseError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const signOut = async () => {
    clearError();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Supabase sign out error:', err);
      }
    }
    setSession(null);
    setUser(null);
    setIsDemoUser(true);
  };

  const resetPassword = async (email: string) => {
    clearError();
    if (!supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth?type=recovery',
      });

      if (error) {
        const friendlyMsg = formatSupabaseError(error);
        setAuthError(friendlyMsg);
        return { success: false, error: friendlyMsg };
      }

      return { success: true };
    } catch (err) {
      const friendlyMsg = formatSupabaseError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const resendVerification = async (email: string) => {
    clearError();
    if (!supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) {
        const friendlyMsg = formatSupabaseError(error);
        setAuthError(friendlyMsg);
        return { success: false, error: friendlyMsg };
      }

      return { success: true };
    } catch (err) {
      const friendlyMsg = formatSupabaseError(err);
      setAuthError(friendlyMsg);
      return { success: false, error: friendlyMsg };
    }
  };

  const switchToDemoMode = () => {
    clearError();
    setIsDemoUser(true);
  };

  const updateProfile = async (profile: { name: string; email: string; company: string; role: string }) => {
    if (!supabase || !user) return { success: false, error: 'Sign in to save your account profile.' };

    const name = profile.name.trim();
    const email = profile.email.trim().toLowerCase();
    if (!name || !email) {
      return { success: false, error: 'Name and email are required.' };
    }

    try {
      const emailChanged = email !== user.email?.toLowerCase();
      const { data, error } = await supabase.auth.updateUser({
        ...(emailChanged ? { email } : {}),
        data: {
          ...user.user_metadata,
          full_name: name,
          company_name: profile.company.trim(),
          gtm_role: profile.role.trim(),
        },
      });
      if (error) return { success: false, error: formatSupabaseError(error) };
      if (!data.user) return { success: false, error: 'Profile update returned no user. Please retry.' };
      setUser(data.user);
      return { success: true, emailConfirmationPending: emailChanged };
    } catch (error) {
      return { success: false, error: formatSupabaseError(error) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        workspaceUser,
        loading,
        isConfigured: isSupabaseConfigured,
        isDemoUser,
        authError,
        clearError,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
        resetPassword,
        resendVerification,
        updateProfile,
        switchToDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
