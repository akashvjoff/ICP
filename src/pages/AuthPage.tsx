import React, { useState, useEffect } from 'react';
import { useRouter } from '../lib/router';
import { useAuth } from '../lib/auth';
import { useAppStore } from '../lib/store';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { FormField, BrutalistInput } from '../components/ui/FormField';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { StickerBadge } from '../components/ui/StickerBadge';
import { ArrowRight, Sparkles, Lock, Mail, User, KeyRound, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { navigate } = useRouter();
  const { addToast } = useAppStore();
  const {
    user,
    session,
    signIn,
    signInWithGoogle,
    signUp,
    resetPassword,
    resendVerification,
    switchToDemoMode,
    isConfigured,
    loading: authLoading,
    authError,
    clearError,
  } = useAuth();

  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    return url.searchParams.get('error_description') || fragment.get('error_description') ||
      url.searchParams.get('error') || fragment.get('error') || '';
  });
  const [verificationPendingEmail, setVerificationPendingEmail] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const oauthError = url.searchParams.get('error_description') || fragment.get('error_description') ||
      url.searchParams.get('error') || fragment.get('error');
    if (oauthError) {
      setLocalError(oauthError);
      window.history.replaceState({}, '', '/auth');
    }
  }, []);

  // If already authenticated with Supabase session, redirect to dashboard
  useEffect(() => {
    if (!authLoading && session && user && !localError && !authError) {
      navigate('/dashboard');
    }
  }, [authLoading, session, user, localError, authError, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email) {
      setLocalError('Please enter your work email.');
      return;
    }

    if (tab !== 'forgot' && !password) {
      setLocalError('Please enter your account password.');
      return;
    }

    if (tab === 'signup' && password.length < 8) {
      setLocalError('Use at least 8 characters for your password.');
      return;
    }

    setLoading(true);

    try {
      if (tab === 'signin') {
        const res = await signIn(email, password);
        if (res.success) {
          addToast('Signed in successfully. Welcome to FiguredIt!', 'success');
          navigate('/dashboard');
        } else {
          setLocalError(res.error || 'Failed to sign in.');
        }
      } else if (tab === 'signup') {
        const normalizedEmail = email.trim().toLowerCase();
        const res = await signUp(normalizedEmail, password, {
          full_name: fullName,
          company_name: companyName,
        });

        if (res.success) {
          if (res.requiresEmailConfirmation) {
            setVerificationPendingEmail(normalizedEmail);
            addToast('Account registered! Please confirm via verification email.', 'info');
          } else {
            addToast('Account created successfully! Welcome aboard.', 'success');
            navigate('/onboarding');
          }
        } else {
          setLocalError(res.error || 'Registration failed.');
        }
      } else if (tab === 'forgot') {
        const res = await resetPassword(email);
        if (res.success) {
          setResetSent(true);
          addToast('Password reset link dispatched to your email.', 'info');
        } else {
          setLocalError(res.error || 'Unable to send password reset link.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    try {
      await switchToDemoMode();
      addToast('Signed in with Demo Founder Credentials (Synthetix Data Cloud).', 'success');
      navigate('/dashboard');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not start demo mode.');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setLocalError('');
    const result = await signInWithGoogle();
    if (!result.success) setLocalError(result.error || 'Google sign-in could not start.');
    setLoading(false);
  };

  const handleResendVerification = async () => {
    if (!verificationPendingEmail) return;
    setLoading(true);
    const res = await resendVerification(verificationPendingEmail);
    setLoading(false);
    if (res.success) {
      addToast('New verification email dispatched.', 'success');
    } else {
      setLocalError(res.error || 'Failed to resend verification.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F4] flex flex-col justify-between p-6 sm:p-10 font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
      {/* Top Bar */}
      <div className="flex items-center justify-between max-w-5xl mx-auto w-full mb-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 cursor-pointer focus:outline-hidden"
        >
          <span className="w-3.5 h-3.5 bg-[#A1F000] border-[2px] border-[#0A0A0A] shadow-[1.5px_1.5px_0px_#0A0A0A]" />
          <span className="text-2xl font-black tracking-tighter text-[#0A0A0A]">
            icp<span className="text-[#A1F000]">.</span>mode
          </span>
        </button>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-white border-[1.5px] border-[#0A0A0A] px-2.5 py-1 rounded-md text-[11px] font-mono font-bold shadow-[1.5px_1.5px_0px_#0A0A0A]">
            <span className={`w-2 h-2 rounded-full border border-[#0A0A0A] ${isConfigured ? 'bg-[#A1F000]' : 'bg-[#FFE3B3]'}`} />
            {isConfigured ? 'SUPABASE POSTGRES LIVE' : 'DEMO PERSISTENCE'}
          </div>

          <button
            onClick={() => navigate('/')}
            className="font-mono text-xs font-bold text-[#0A0A0A] hover:underline cursor-pointer"
          >
            ← BACK TO HOME
          </button>
        </div>
      </div>

      {/* Main Auth Container */}
      <div className="max-w-md mx-auto w-full my-auto">
        <BrutalistCard bg="white" shadowSize="lg" className="p-7 sm:p-9 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <SectionEyebrow color="bg-[#6AAAFB]">
              ACCOUNT ACCESS
            </SectionEyebrow>
            <h1 className="text-3xl font-black text-[#0A0A0A] tracking-tight">
              {tab === 'signin' && 'Sign in to FiguredIt'}
              {tab === 'signup' && 'Create an Account'}
              {tab === 'forgot' && 'Reset Password'}
            </h1>
            <p className="text-xs text-[#0A0A0A]/70 font-medium">
              {tab === 'signin' && 'Access your Ideal Customer Profile discoveries and lead dossiers.'}
              {tab === 'signup' && 'Provision your private workspace and connect your ICP analysis engine.'}
              {tab === 'forgot' && 'Enter your email to receive a secure recovery magic link.'}
            </p>
          </div>

          {/* Verification Notice Screen */}
          {verificationPendingEmail ? (
            <div className="bg-[#E5F7E5] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] space-y-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-white border-[2px] border-[#0A0A0A] flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  CONFIRMATION EMAIL SENT
                </h3>
                <p className="text-xs text-[#0A0A0A]/80 font-medium">
                  We sent a confirmation link to <strong className="font-bold">{verificationPendingEmail}</strong>. Please check your inbox and click the link to activate your workspace.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <BrutalistButton
                  variant="lime"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="w-full text-xs font-black"
                  icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
                >
                  RESEND CONFIRMATION LINK
                </BrutalistButton>

                <button
                  onClick={() => setVerificationPendingEmail(null)}
                  className="font-mono text-[11px] font-bold text-[#0A0A0A] hover:underline cursor-pointer"
                >
                  ← RETURN TO SIGN IN
                </button>
              </div>
            </div>
          ) : resetSent ? (
            <div className="bg-[#E4E6FB] border-[2.5px] border-[#0A0A0A] p-5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] space-y-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-white border-[2px] border-[#0A0A0A] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#8C6ADE]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
                  PASSWORD RESET DISPATCHED
                </h3>
                <p className="text-xs text-[#0A0A0A]/80 font-medium">
                  If an account exists for <strong className="font-bold">{email}</strong>, a password reset link has been dispatched.
                </p>
              </div>

              <BrutalistButton
                variant="white"
                size="sm"
                onClick={() => { setResetSent(false); setTab('signin'); }}
                className="w-full text-xs font-black"
              >
                RETURN TO SIGN IN
              </BrutalistButton>
            </div>
          ) : (
            <>
              {/* Tab Switcher */}
              <div className="flex p-1 bg-[#F9F8F4] border-[2px] border-[#0A0A0A] rounded-xl font-mono text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setTab('signin'); setLocalError(''); clearError(); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    tab === 'signin'
                      ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                      : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
                  }`}
                >
                  SIGN IN
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('signup'); setLocalError(''); clearError(); }}
                  className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                    tab === 'signup'
                      ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A]'
                      : 'text-[#0A0A0A]/60 hover:text-[#0A0A0A]'
                  }`}
                >
                  REGISTER
                </button>
              </div>

              {/* Instant Preview Demo Login Option */}
              <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[3px_3px_0px_#0A0A0A] text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 font-mono text-[11px] font-black uppercase text-[#0A0A0A]">
                  <Sparkles className="w-3.5 h-3.5 text-[#8C6ADE]" />
                  INSTANT PREVIEW ACCESS
                </div>
                <p className="text-[11px] text-[#0A0A0A]/80 font-medium leading-tight">
                  Instant test drive with pre-scored accounts. Zero setup required.
                </p>
                <BrutalistButton
                  type="button"
                  variant="white"
                  size="sm"
                  onClick={handleDemoSignIn}
                  className="w-full text-xs font-black tracking-wider"
                >
                  ONE-CLICK DEMO FOUNDER LOGIN
                </BrutalistButton>
              </div>

              {isConfigured && tab !== 'forgot' && (
                <BrutalistButton
                  type="button"
                  variant="white"
                  size="md"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full font-black tracking-wider text-xs"
                  icon={<span aria-hidden="true" className="text-base font-black text-[#4285F4]">G</span>}
                >
                  CONTINUE WITH GOOGLE
                </BrutalistButton>
              )}

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t-[1.5px] border-[#0A0A0A]/20"></div>
                <span className="flex-shrink mx-3 font-mono text-[10px] font-black uppercase text-[#0A0A0A]/50">
                  {tab === 'forgot' ? 'ACCOUNT RECOVERY' : 'OR WITH CREDENTIALS'}
                </span>
                <div className="flex-grow border-t-[1.5px] border-[#0A0A0A]/20"></div>
              </div>

              {/* Error Alert Banner */}
              {(localError || authError) && (
                <div className="bg-[#FFB6C2] border-[2px] border-[#0A0A0A] p-3 rounded-xl shadow-[2px_2px_0px_#0A0A0A] flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-[#0A0A0A] leading-snug">
                    {localError || authError}
                  </p>
                </div>
              )}

              {/* Credential Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {tab === 'signup' && (
                  <>
                    <FormField label="FULL NAME">
                      <BrutalistInput
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Vance"
                        required
                      />
                    </FormField>

                    <FormField label="COMPANY NAME">
                      <BrutalistInput
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Synthetix Data Cloud"
                        required
                      />
                    </FormField>
                  </>
                )}

                <FormField label="WORK EMAIL">
                  <BrutalistInput
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setLocalError(''); }}
                    placeholder="founder@company.com"
                    required
                  />
                </FormField>

                {tab !== 'forgot' && (
                  <FormField label="PASSWORD">
                    <BrutalistInput
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setLocalError(''); }}
                      placeholder="••••••••••••"
                      required
                    />
                  </FormField>
                )}

                {tab === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => { setTab('forgot'); setLocalError(''); }}
                      className="font-mono text-[11px] font-bold text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:underline cursor-pointer"
                    >
                      FORGOT PASSWORD?
                    </button>
                  </div>
                )}

                {tab === 'forgot' && (
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => { setTab('signin'); setLocalError(''); }}
                      className="font-mono text-[11px] font-bold text-[#0A0A0A]/70 hover:text-[#0A0A0A] hover:underline cursor-pointer"
                    >
                      ← BACK TO SIGN IN
                    </button>
                  </div>
                )}

                <BrutalistButton
                  type="submit"
                  variant="lime"
                  size="md"
                  disabled={loading}
                  className="w-full mt-2 font-black tracking-wider text-xs"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  {loading
                    ? 'CONNECTING...'
                    : tab === 'signin'
                    ? 'SIGN IN TO DASHBOARD'
                    : tab === 'signup'
                    ? 'CREATE ACCOUNT & ONBOARD'
                    : 'SEND RECOVERY LINK'}
                </BrutalistButton>
              </form>
            </>
          )}
        </BrutalistCard>
      </div>

      <div className="text-center font-mono text-xs text-[#0A0A0A]/50 mt-8">
        FiguredIt · AI-powered customer intelligence · Supabase Auth Protected ·{' '}
        <a href="/privacy" className="underline hover:text-[#0A0A0A]">Privacy notice</a>
      </div>
    </div>
  );
};
