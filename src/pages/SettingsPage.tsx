import React, { useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';
import { useAppStore } from '../lib/store';
import { useAuth } from '../lib/auth';
import { contactEmail, contactHref } from '../lib/contact';
import { AppLayout } from '../components/layout/AppLayout';
import { SectionEyebrow } from '../components/ui/SectionEyebrow';
import { BrutalistCard } from '../components/ui/BrutalistCard';
import { BrutalistButton } from '../components/ui/BrutalistButton';
import { FormField, BrutalistInput } from '../components/ui/FormField';

export const SettingsPage: React.FC = () => {
  const { user: storeUser, updateDemoProfile, addToast } = useAppStore();
  const { workspaceUser, user: authUser, updateProfile } = useAuth();

  const [userName, setUserName] = useState(authUser ? workspaceUser.name : storeUser.name);
  const [userEmail, setUserEmail] = useState(authUser ? workspaceUser.email : storeUser.email);
  const [userCompany, setUserCompany] = useState(authUser ? (authUser.user_metadata?.company_name || '') : storeUser.company);
  const [userRole, setUserRole] = useState(authUser ? (authUser.user_metadata?.gtm_role || 'Founder') : storeUser.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);

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

  return (
    <AppLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="border-b-[2.5px] border-[#0A0A0A] pb-6">
          <SectionEyebrow color="bg-[#8C6ADE]">YOUR ACCOUNT</SectionEyebrow>
          <h1 className="text-3xl sm:text-4xl font-black text-[#0A0A0A] tracking-tight">Settings</h1>
          <p className="text-xs text-[#0A0A0A]/70 font-medium mt-1">Manage your profile and review how your data is handled.</p>
        </div>

        <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/15 pb-3">
            <User className="w-5 h-5 text-[#0A0A0A]" />
            <h2 className="text-lg font-black text-[#0A0A0A]">Profile</h2>
          </div>
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <FormField label="YOUR NAME">
              <BrutalistInput type="text" value={userName} onChange={(e) => setUserName(e.target.value)} />
            </FormField>
            <FormField label="WORK EMAIL">
              <BrutalistInput type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} />
            </FormField>
            {emailConfirmationPending && (
              <p className="md:col-span-2 text-xs font-mono font-bold text-amber-900">
                Your current email stays active until you confirm the change from your inbox.
              </p>
            )}
            <FormField label="COMPANY NAME">
              <BrutalistInput type="text" value={userCompany} onChange={(e) => setUserCompany(e.target.value)} />
            </FormField>
            <FormField label="GTM ROLE">
              <BrutalistInput type="text" value={userRole} onChange={(e) => setUserRole(e.target.value)} />
            </FormField>
            <div className="md:col-span-2 pt-2 flex justify-end">
              <BrutalistButton type="submit" variant="lime" size="sm" disabled={savingProfile}>
                {savingProfile ? 'SAVING...' : 'SAVE PROFILE'}
              </BrutalistButton>
            </div>
          </form>
        </BrutalistCard>

        <BrutalistCard bg="lavender" shadowSize="md" className="p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 border-b-[2px] border-[#0A0A0A]/20 pb-3">
            <ShieldCheck className="w-5 h-5 text-[#0A0A0A]" />
            <h2 className="text-lg font-black text-[#0A0A0A]">Data &amp; privacy</h2>
          </div>
          <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
            Your signed-in workspace is tied to your account. Demo data stays in this browser.
            Read our <a href="/privacy" className="font-bold underline">privacy notice</a> and <a href="/terms" className="font-bold underline">terms of use</a>.
          </p>
          <p className="text-xs text-[#0A0A0A]/80 font-medium leading-relaxed">
            For account or data requests, contact <a href={contactHref} className="font-bold underline">{contactEmail}</a>.
          </p>
        </BrutalistCard>
      </div>
    </AppLayout>
  );
};
