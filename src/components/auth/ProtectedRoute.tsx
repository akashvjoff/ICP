import React from 'react';
import { useRouter } from '../../lib/router';
import { useAuth } from '../../lib/auth';
import { BrutalistCard } from '../ui/BrutalistCard';
import { BrutalistButton } from '../ui/BrutalistButton';
import { SectionEyebrow } from '../ui/SectionEyebrow';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { session, user, isDemoUser, loading } = useAuth();
  const { navigate } = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F4] flex items-center justify-center font-sans p-6">
        <div className="bg-white border-[3px] border-[#0A0A0A] p-6 rounded-2xl shadow-[5px_5px_0px_#0A0A0A] flex items-center gap-3">
          <div className="w-4 h-4 bg-[#A1F000] border-[2px] border-[#0A0A0A] animate-spin" />
          <span className="font-mono text-xs font-black uppercase tracking-wider text-[#0A0A0A]">
            AUTHENTICATING WORKSPACE...
          </span>
        </div>
      </div>
    );
  }

  // Access granted if user has an active Supabase session or is in Demo mode
  const hasAccess = Boolean(session || user || isDemoUser);

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#F9F8F4] flex items-center justify-center font-sans p-6 selection:bg-[#A1F000] selection:text-[#0A0A0A]">
        <div className="max-w-md w-full">
          <BrutalistCard bg="white" shadowSize="lg" className="p-8 text-center space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFE3B3] border-[2.5px] border-[#0A0A0A] flex items-center justify-center shadow-[3px_3px_0px_#0A0A0A]">
              <Lock className="w-7 h-7 text-[#0A0A0A]" />
            </div>

            <div className="space-y-2">
              <SectionEyebrow color="bg-[#FFB6C2]">
                PROTECTED WORKSPACE
              </SectionEyebrow>
              <h2 className="text-2xl font-black text-[#0A0A0A] tracking-tight">
                Authentication Required
              </h2>
              <p className="text-xs text-[#0A0A0A]/70 font-medium leading-relaxed">
                Sign in to open your workspace, or explore five sample accounts in the public demo.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <BrutalistButton
                variant="lime"
                size="md"
                onClick={() => navigate('/auth')}
                className="w-full text-xs font-black tracking-wider"
                icon={<ArrowRight className="w-4 h-4" />}
              >
                SIGN IN TO YOUR ACCOUNT
              </BrutalistButton>
              <a href="/demo" className="block w-full rounded-xl border-[2.5px] border-[#0A0A0A] bg-white px-5 py-2.5 text-xs font-black tracking-wider shadow-[4px_5px_0px_#0A0A0A] hover:bg-[#F9F8F4]">
                EXPLORE PUBLIC DEMO
              </a>
            </div>
          </BrutalistCard>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
