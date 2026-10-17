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
import { freshAccessToken } from '../lib/supabase';
import { useRouter } from '../lib/router';

export const SettingsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { user: storeUser, updateDemoProfile, addToast, datasets, refreshLiveWorkspace } = useAppStore();
  const { workspaceUser, user: authUser, updateProfile, signOut } = useAuth();

  const [userName, setUserName] = useState(authUser ? workspaceUser.name : storeUser.name);
  const [userEmail, setUserEmail] = useState(authUser ? workspaceUser.email : storeUser.email);
  const [userCompany, setUserCompany] = useState(authUser ? (authUser.user_metadata?.company_name || '') : storeUser.company);
  const [userRole, setUserRole] = useState(authUser ? (authUser.user_metadata?.gtm_role || 'Founder') : storeUser.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [emailConfirmationPending, setEmailConfirmationPending] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState('');

  const requestError = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    return new Error(body.error || 'Please try again.');
  };

  const handleDeleteDataset = async () => {
    const id = selectedDatasetId || datasets[0]?.id;
    if (!authUser || !id) return;
    const name = datasets.find(dataset => dataset.id === id)?.filename || 'this dataset';
    if (!window.confirm(`Delete ${name} and its contacts, analyses, scores, segments, and reports? This cannot be undone.`)) return;
    setDataBusy(true);
    setDataError('');
    try {
      const token = await freshAccessToken();
      const response = await fetch(`/api/datasets/${encodeURIComponent(id)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw await requestError(response);
      setSelectedDatasetId('');
      refreshLiveWorkspace();
      addToast('Dataset and its related data deleted.', 'success');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'The dataset could not be deleted.');
    } finally {
      setDataBusy(false);
    }
  };

  const handleExportData = async () => {
    if (!authUser) return;
    setDataBusy(true);
    setDataError('');
    try {
      const token = await freshAccessToken();
      const response = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw await requestError(response);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'figuredit_my_data.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Your data could not be exported.');
    } finally {
      setDataBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!authUser || deleteConfirmation !== 'DELETE') return;
    setDataBusy(true);
    setDataError('');
    try {
      const token = await freshAccessToken();
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: deleteConfirmation }),
      });
      if (!response.ok) throw await requestError(response);
      await signOut().catch(() => undefined);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('icp_mode_') || /^sb-[a-z0-9]+-auth-token$/.test(key)) localStorage.removeItem(key);
      }
      window.location.replace('/auth');
    } catch (error) {
      setDataError(error instanceof Error ? error.message : 'Your account could not be deleted.');
      setDataBusy(false);
    }
  };

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

        {authUser && <BrutalistCard bg="white" shadowSize="md" className="p-6 sm:p-7">
          <h2 className="text-lg font-black">Billing</h2>
          <p className="mt-2 text-sm">Review your plan, usage, and renewal date.</p>
          <a href="/settings/billing" className="mt-4 inline-block rounded-lg border-2 border-black bg-[#A1F000] px-4 py-3 font-mono text-xs font-black shadow-[3px_3px_0px_#0A0A0A]">MANAGE BILLING</a>
        </BrutalistCard>}

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
          {authUser ? (
            <div className="space-y-5 border-t-[2px] border-[#0A0A0A]/20 pt-5">
              {datasets.length === 0 && <div className="bg-white border-2 border-black rounded-lg p-4 space-y-2">
                <p className="text-sm font-black">No datasets yet</p>
                <p className="text-xs">Add your first list to begin analysis.</p>
                <BrutalistButton type="button" variant="lime" size="sm" onClick={() => navigate('/start')}>ADD YOUR FIRST LIST</BrutalistButton>
              </div>}
              {datasets.length > 0 && <div className="space-y-2">
                <p className="text-sm font-black">Delete a dataset</p>
                <p className="text-xs">This also removes its contacts, analyses, scores, segments, and reports.</p>
                <select aria-label="Dataset to delete" value={selectedDatasetId || datasets[0]?.id || ''}
                  onChange={event => setSelectedDatasetId(event.target.value)}
                  className="w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm">
                  {datasets.map(dataset => <option key={dataset.id} value={dataset.id}>{dataset.filename}</option>)}
                </select>
                <BrutalistButton type="button" variant="white" size="sm" disabled={dataBusy || datasets.length === 0} onClick={handleDeleteDataset}>DELETE DATASET</BrutalistButton>
              </div>}
              <div className="space-y-2 border-t-[2px] border-[#0A0A0A]/20 pt-4">
                <p className="text-sm font-black">Export all my data</p>
                <p className="text-xs">Download your account and workspace records as JSON.</p>
                <BrutalistButton type="button" variant="white" size="sm" disabled={dataBusy} onClick={handleExportData}>DOWNLOAD JSON</BrutalistButton>
              </div>
              <div className="space-y-2 border-t-[2px] border-[#0A0A0A]/20 pt-4">
                <p className="text-sm font-black">Delete my account</p>
                <p className="text-xs">Permanently remove your account and workspace. Type DELETE to confirm.</p>
                <BrutalistInput aria-label="Type DELETE to confirm account deletion" value={deleteConfirmation}
                  onChange={event => setDeleteConfirmation(event.target.value)} placeholder="DELETE" />
                <BrutalistButton type="button" variant="white" size="sm" disabled={dataBusy || deleteConfirmation !== 'DELETE'} onClick={handleDeleteAccount}>DELETE MY ACCOUNT</BrutalistButton>
              </div>
              {dataError && <p role="alert" className="text-xs font-bold text-rose-800">{dataError}</p>}
            </div>
          ) : <p className="text-xs font-bold">Sign in to export or delete account data. Demo data stays in this browser.</p>}
        </BrutalistCard>
      </div>
    </AppLayout>
  );
};
