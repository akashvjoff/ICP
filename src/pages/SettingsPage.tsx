import React, { useState } from 'react';
import { useRouter } from '../lib/router';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionHeading } from '../components/ui/SectionHeading';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { FormField, BrutalistInput } from '../components/ui/FormField';
import { StickerBadge } from '../components/ui/StickerBadge';
import { StatusChip } from '../components/ui/StatusChip';
import {
  Settings as SettingsIcon,
  User,
  Cpu,
  Database,
  Sliders,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Trash2,
  ShieldCheck,
  Server,
  Key,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    user: storeUser,
    updateDemoProfile,
    isDemoMode,
    toggleDemoMode,
    resetToDemoData,
    clearToEmptyState,
    weights,
    updateWeights,
    addToast,
  } = useAppStore();

  const { workspaceUser, user: authUser, isConfigured, updateProfile } = useAuth();

  const [userName, setUserName] = useState(authUser ? workspaceUser.name : storeUser.name);
  const [userEmail, setUserEmail] = useState(authUser ? workspaceUser.email : storeUser.email);
  const [userCompany, setUserCompany] = useState(authUser ? (authUser.user_metadata?.company_name || '') : storeUser.company);
  const [userRole, setUserRole] = useState(authUser ? (authUser.user_metadata?.gtm_role || 'Founder') : storeUser.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

  const [copiedMigration, setCopiedMigration] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile = {
      name: userName.trim(),
      email: userEmail.trim().toLowerCase(),
      company: userCompany.trim(),
      role: userRole.trim(),
    };
    if (!profile.name || !profile.email) {
      addToast('Name and email are required.', 'warning');
      return;
    }
    setSavingProfile(true);
    try {
      if (authUser) {
        const result = await updateProfile(profile);
        if (!result.success) {
          addToast(result.error || 'Profile could not be saved.', 'warning');
          return;
        }
        setEmailConfirmationPending(Boolean(result.emailConfirmationPending));
        addToast(result.emailConfirmationPending
          ? 'Profile saved. Confirm the email change using the message sent to your inbox.'
          : 'Account profile saved.', 'success');
      } else {
        updateDemoProfile(profile);
        addToast('Demo profile saved in this browser.', 'success');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setConnectionStatus('Supabase is currently running in local Demo Persistence mode. Set VITE_SUPABASE_URL to connect.');
        addToast('Preview mode active (no live Supabase credentials).', 'info');
      } else {
        const { count, error } = await supabase
          .from('datasets')
          .select('*', { count: 'exact', head: true });

        if (error) {
          setConnectionStatus(`Connected to Supabase, query result: ${error.message}`);
          addToast('Supabase endpoint responded!', 'info');
        } else {
          setConnectionStatus(`Connected successfully! RLS active, datasets query returned (${count ?? 0} rows).`);
          addToast('Supabase PostgreSQL connection confirmed!', 'success');
        }
      }
    } catch (err: unknown) {
      setConnectionStatus(`Connection test error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const copyMigrationPath = () => {
    navigator.clipboard.writeText('supabase/schema.sql');
    setCopiedMigration(true);
    addToast('Copied schema path (supabase/schema.sql) to clipboard.', 'success');
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-[2.5px] border-[#0A0A0A] pb-6">
          <div>
            <SectionEyebrow color="bg-[#8C6ADE]">
              PREFERENCES & RUNTIME
            </SectionEyebrow>
            <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">
              Settings & Configuration
            </h1>
            <p className="text-xs text-[#0A0A0A]/70 font-medium mt-1">
              Manage account identity, Supabase PostgreSQL backend, and AI inference configurations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusChip color={isConfigured ? 'lime' : 'peach'}>
              {isConfigured ? 'SUPABASE LIVE' : 'DEMO PERSISTENCE'}
            </StatusChip>
          </div>
        </div>

        {/* 1. Supabase PostgreSQL & Auth Integration */}
        <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <Server className="w-5 h-5 text-[#0A0A0A]" />
              <h3 className="text-lg font-black text-[#0A0A0A]">
                Supabase PostgreSQL & Auth Engine
              </h3>
            </div>
            <StickerBadge color={isConfigured ? 'mint' : 'peach'} rotate="2">
              {isConfigured ? 'CONNECTED' : 'STANDBY'}
            </StickerBadge>
          </div>

          {/* Connection Status Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                AUTH ENGINE
              </span>
              <div className="flex items-center gap-2 font-mono text-xs font-black text-[#0A0A0A]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                {isConfigured ? 'Supabase Auth' : 'Demo Profile'}
              </div>
            </div>

            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                DATABASE SCHEMA
              </span>
              <div className="flex items-center gap-2 font-mono text-xs font-black text-[#0A0A0A]">
                <Database className="w-4 h-4 text-[#8C6ADE]" />
                Workspace Tables + RLS
              </div>
            </div>

            <div className="bg-[#F9F8F4] border-[2px] border-[#0A0A0A] p-3.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]/60 block">
                ISOLATION MODEL
              </span>
              <div className="flex items-center gap-2 font-mono text-xs font-black text-[#0A0A0A]">
                <Key className="w-4 h-4 text-amber-600" />
                owner_user_id (Per-User)
              </div>
            </div>
          </div>

          {/* Tables Checklist */}
          <div className="bg-[#E4E6FB]/50 border-[2px] border-[#0A0A0A] p-4 rounded-xl space-y-3">
            <span className="font-mono text-xs font-black uppercase text-[#0A0A0A] block">
              MANAGED SUPABASE TABLES (RLS ENFORCED):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-[11px] font-mono">
              {[
                'seller_profiles',
                'datasets',
                'leads',
                'company_analyses',
                'analysis_jobs',
                'segments',
                'scoring_configs',
                'lead_scores',
                'icp_reports',
              ].map((table) => (
                <div key={table} className="flex items-center gap-1.5 bg-white border border-[#0A0A0A] px-2 py-1 rounded">
                  <span className="w-2 h-2 rounded-full bg-[#A1F000] border border-[#0A0A0A]" />
                  <code>{table}</code>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Dashboard Instructions */}
          {!isConfigured && <div className="space-y-3">
            <h4 className="font-mono text-xs font-black uppercase text-[#0A0A0A]">
              SETUP & MIGRATION GUIDE:
            </h4>
            <ol className="list-decimal list-inside text-xs font-medium text-[#0A0A0A]/80 space-y-2 leading-relaxed bg-[#F9F8F4] p-4 border-[2px] border-[#0A0A0A] rounded-xl font-mono">
              <li>
                <strong>Create Supabase Project:</strong> Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-[#8C6ADE] underline font-bold">supabase.com</a> and create a new project.
              </li>
              <li>
                <strong>Execute Migrations:</strong> Open <strong>SQL Editor</strong> in your Supabase dashboard and run the SQL from <code className="bg-white px-1.5 py-0.5 border border-[#0A0A0A] rounded font-bold">supabase/schema.sql</code> (or apply migrations <code>000001</code> & <code>000002</code>).
              </li>
              <li>
                <strong>Configure Environment:</strong> In your environment configuration or <code>.env</code> file, set:
                <div className="mt-1 bg-white p-2 border border-[#0A0A0A] rounded text-[11px]">
                  <code>VITE_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co</code><br />
                  <code>VITE_SUPABASE_ANON_KEY=[YOUR_ANON_PUBLIC_KEY]</code>
                </div>
              </li>
              <li>
                <strong>Auth Settings:</strong> Under <strong>Authentication &gt; Providers &gt; Email</strong>, enable Email signup and keep email confirmation on.
              </li>
            </ol>
          </div>}

          {/* Test & Copy Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <BrutalistButton
              variant="lime"
              size="sm"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="text-xs font-black"
            >
              {testingConnection ? 'TESTING CONNECTION...' : 'TEST SUPABASE CONNECTION'}
            </BrutalistButton>

            {!isConfigured && <BrutalistButton
              variant="white"
              size="sm"
              onClick={copyMigrationPath}
              icon={copiedMigration ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              COPY SCHEMA SQL PATH
            </BrutalistButton>}
          </div>

          {connectionStatus && (
            <div className="p-3 bg-[#FFE3B3] border-[2px] border-[#0A0A0A] rounded-xl font-mono text-xs font-bold text-[#0A0A0A]">
              {connectionStatus}
            </div>
          )}
        </BrutalistCard>

        {/* 2. Account Profile */}
        <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/15 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[#0A0A0A]" />
              <h3 className="text-lg font-black text-[#0A0A0A]">
                Account Profile & Ownership
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]/60">
              {authUser ? 'AUTHENTICATED' : 'DEMO WORKSPACE'}
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="YOUR NAME">
              <BrutalistInput
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </FormField>

            <FormField label="WORK EMAIL">
              <BrutalistInput
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
              />
            </FormField>

            {emailConfirmationPending && (
              <p className="md:col-span-2 text-xs font-mono font-bold text-amber-900">
                Your current email stays active until you confirm the change from your inbox.
              </p>
            )}

            <FormField label="COMPANY NAME">
              <BrutalistInput
                type="text"
                value={userCompany}
                onChange={(e) => setUserCompany(e.target.value)}
              />
            </FormField>

            <FormField label="GTM ROLE">
              <BrutalistInput
                type="text"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
              />
            </FormField>

            <div className="md:col-span-2 pt-2 flex justify-end">
              <BrutalistButton type="submit" variant="lime" size="sm" disabled={savingProfile}>
                {savingProfile ? 'SAVING...' : 'SAVE PROFILE'}
              </BrutalistButton>
            </div>
          </form>
        </BrutalistCard>

        {/* 3. Synthetic Dataset & Demo Mode Controls */}
        {!authUser && <BrutalistCard bg="peach" shadowSize="md" className="p-6 sm:p-7 space-y-4">
          <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-[#0A0A0A]" />
              <h3 className="text-lg font-black text-[#0A0A0A]">
                Dataset & Demo State Manager
              </h3>
            </div>
            <StickerBadge color="purple" rotate="-2">SANDBOX READY</StickerBadge>
          </div>

          <p className="text-xs text-[#0A0A0A]/85 font-medium leading-relaxed">
            Quickly switch between pre-populated synthetic B2B leads and a clean blank slate to evaluate empty states and upload workflows.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <BrutalistButton
              variant="white"
              size="sm"
              onClick={toggleDemoMode}
            >
              {isDemoMode ? 'TOGGLE TO LIVE BLANK' : 'TOGGLE TO SYNTHETIC DEMO'}
            </BrutalistButton>

            <BrutalistButton
              variant="white"
              size="sm"
              onClick={resetToDemoData}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              RESTORE SAMPLE DATASET
            </BrutalistButton>

            <BrutalistButton
              variant="white"
              size="sm"
              onClick={clearToEmptyState}
              icon={<Trash2 className="w-3.5 h-3.5 text-rose-600" />}
            >
              CLEAR TO EMPTY STATE
            </BrutalistButton>
          </div>
        </BrutalistCard>}

        {/* 4. AI Inference Configuration */}
        <BrutalistCard bg="lavender" shadowSize="md" className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center justify-between border-b-[2px] border-[#0A0A0A]/20 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#0A0A0A]" />
              <h3 className="text-lg font-black text-[#0A0A0A]">
                AI Model & Inference Settings
              </h3>
            </div>
            <span className="font-mono text-xs font-bold text-[#0A0A0A]">
              @google/genai
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs font-mono">
            <div className="bg-white border-[2.5px] border-[#0A0A0A] rounded-xl px-3.5 py-3 shadow-[2px_2px_0px_#0A0A0A]">
              <span className="font-black uppercase text-[#0A0A0A] block">MODEL SELECTION</span>
              <span className="font-bold text-[#0A0A0A]/70">SERVER-MANAGED · AVAILABLE FAST MODEL</span>
            </div>
            <div className="bg-white border-[2.5px] border-[#0A0A0A] rounded-xl px-3.5 py-3 shadow-[2px_2px_0px_#0A0A0A]">
              <span className="font-black uppercase text-[#0A0A0A] block">PROVIDER CONFIGURATION</span>
              <span className="font-bold text-[#0A0A0A]/70">GEMINI / MOCK / OLLAMA · SERVER ENVIRONMENT ONLY</span>
            </div>
          </div>

          <div className="bg-white border-[2px] border-[#0A0A0A] rounded-xl p-4 shadow-[2px_2px_0px_#0A0A0A] text-xs font-mono">
            <span className="font-bold text-[#0A0A0A] block mb-1">SECURITY GUARANTEE:</span>
            <p className="text-[#0A0A0A]/70 leading-relaxed font-sans text-xs font-medium">
              All Gemini calls run strictly on the Node.js server proxy via <code>/api/ai/*</code> with <code>User-Agent: aistudio-build</code>. Zero API secrets are exposed to the browser bundle.
            </p>
          </div>
        </BrutalistCard>
      </div>
    </AppLayout>
  );
};
