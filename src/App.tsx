/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Router, useRouter } from './lib/router';
import { AuthProvider, useAuth } from './lib/auth';
import { AppStoreProvider, useAppStore } from './lib/store';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { EmptyState } from './components/ui/EmptyState';

import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage').then(m => ({ default: m.PrivacyPage })));
const AboutPage = React.lazy(() => import('./pages/AboutPage').then(m => ({ default: m.AboutPage })));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage').then(m => ({ default: m.OnboardingPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const UploadWizardPage = React.lazy(() => import('./pages/UploadWizardPage').then(m => ({ default: m.UploadWizardPage })));
const DatasetDetailsPage = React.lazy(() => import('./pages/DatasetDetailsPage').then(m => ({ default: m.DatasetDetailsPage })));
const CompaniesPage = React.lazy(() => import('./pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })));
const CompanyProfilePage = React.lazy(() => import('./pages/CompanyProfilePage').then(m => ({ default: m.CompanyProfilePage })));
const SegmentsPage = React.lazy(() => import('./pages/SegmentsPage').then(m => ({ default: m.SegmentsPage })));
const StrategicAnalysisPage = React.lazy(() => import('./pages/StrategicAnalysisPage').then(m => ({ default: m.StrategicAnalysisPage })));
const ICPReportPage = React.lazy(() => import('./pages/ICPReportPage').then(m => ({ default: m.ICPReportPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PublicDemoPage = React.lazy(() => import('./pages/PublicDemoPage').then(m => ({ default: m.PublicDemoPage })));
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })));
const TermsPage = React.lazy(() => import('./pages/TermsPage').then(m => ({ default: m.TermsPage })));
const PricingPage = React.lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const RefundPolicyPage = React.lazy(() => import('./pages/RefundPolicyPage').then(m => ({ default: m.RefundPolicyPage })));
const ContactPage = React.lazy(() => import('./pages/ContactPage').then(m => ({ default: m.ContactPage })));
const StartAnalysisPage = React.lazy(() => import('./pages/StartAnalysisPage').then(m => ({ default: m.StartAnalysisPage })));
const BillingPage = React.lazy(() => import('./pages/BillingPage').then(m => ({ default: m.BillingPage })));
const ICPGuidePage = React.lazy(() => import('./pages/ICPGuidePage').then(m => ({ default: m.ICPGuidePage })));
import { UpgradeModal } from './components/billing/UpgradeModal';
import { syncPublicAnalytics } from './lib/clientTelemetry';

function RouteSwitch() {
  const { path, navigate } = useRouter();
  const { user } = useAuth();
  const { datasets, workspaceLoading, isContextComplete } = useAppStore();

  useEffect(() => {
    syncPublicAnalytics(path);
    const segment = path.split('/')[1];
    const titles: Record<string, string> = {
      auth: 'Sign in or create an account', demo: 'Try the public demo', start: 'Start your analysis',
      privacy: 'Privacy notice', about: 'About and Q&A', terms: 'Terms of use', pricing: 'Pricing', guides: 'Build an ideal customer profile from a lead list', contact: 'Contact', 'refund-policy': 'Refund policy', dashboard: 'Dashboard', onboarding: 'Set up your offering',
      uploads: 'Lead uploads', companies: 'Companies', segments: 'Segments',
      strategy: 'Strategic analysis', icp: 'ICP report', settings: 'Settings',
    };
    document.title = path === '/'
      ? 'FiguredIt — AI-assisted analysis with an explainable, rule-based score'
      : `${titles[segment] || 'Page not found'} | FiguredIt`;
  }, [path]);

  // Public Root Landing
  if (path === '/' || path === '') {
    return <LandingPage />;
  }

  // Auth & Onboarding
  if (path === '/auth') {
    return <AuthPage />;
  }

  if (path === '/privacy') {
    return <PrivacyPage />;
  }

  if (path === '/about') {
    return <AboutPage />;
  }

  if (path === '/terms') {
    return <TermsPage />;
  }

  if (path === '/pricing') {
    return <PricingPage />;
  }

  if (path === '/guides/ideal-customer-profile-from-leads') {
    return <ICPGuidePage />;
  }

  if (path === '/refund-policy') {
    return <RefundPolicyPage />;
  }

  if (path === '/contact') {
    return <ContactPage />;
  }

  if (path === '/demo') {
    return <PublicDemoPage />;
  }

  if (path === '/start') {
    return <ProtectedRoute><StartAnalysisPage /></ProtectedRoute>;
  }

  if (user && (/^\/(dashboard|companies|segments|strategy)(\/|$)/.test(path) ||
      /^\/uploads\/(?!new$)[^/]+$/.test(path) || /^\/icp\/report(\/|$)/.test(path))) {
    if (workspaceLoading) return <AppLayout><p className="font-mono text-sm">Opening your workspace…</p></AppLayout>;
    if (datasets.length === 0) return <AppLayout><div className="py-16">
      <EmptyState title="Your workspace is ready for its first list"
        description={isContextComplete ? 'Add a company list to start analysis and follow its live progress.' : 'Tell us what you sell, then add a list to start analysis.'}
        actionText={isContextComplete ? 'ADD YOUR FIRST LIST' : 'SET UP WHAT YOU SELL'}
        onAction={() => navigate(isContextComplete ? '/start' : '/onboarding')} />
    </div></AppLayout>;
  }

  if (path === '/onboarding') {
    return (
      <ProtectedRoute>
        <OnboardingPage />
      </ProtectedRoute>
    );
  }

  // Protected: Dashboard Overview
  if (path === '/dashboard') {
    return (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    );
  }

  // Protected: Upload Wizard & Dataset Details
  if (path === '/uploads/new') {
    return (
      <ProtectedRoute>
        <UploadWizardPage />
      </ProtectedRoute>
    );
  }
  if (/^\/uploads\/[^/]+$/.test(path)) {
    const id = path.replace('/uploads/', '');
    return (
      <ProtectedRoute>
        <DatasetDetailsPage params={{ id }} />
      </ProtectedRoute>
    );
  }

  // Protected: Companies Directory & Individual Profile
  if (path === '/companies') {
    return (
      <ProtectedRoute>
        <CompaniesPage />
      </ProtectedRoute>
    );
  }
  if (/^\/companies\/[^/]+$/.test(path)) {
    const id = path.replace('/companies/', '');
    return (
      <ProtectedRoute>
        <CompanyProfilePage params={{ id }} />
      </ProtectedRoute>
    );
  }

  // Protected: Customer Segments (STP)
  if (path === '/segments') {
    return (
      <ProtectedRoute>
        <SegmentsPage />
      </ProtectedRoute>
    );
  }
  if (/^\/segments\/[^/]+$/.test(path)) {
    const id = path.replace('/segments/', '');
    return (
      <ProtectedRoute>
        <SegmentsPage params={{ id }} />
      </ProtectedRoute>
    );
  }


  // Protected: Strategic Marketing Analysis (Need Gap & 5C)
  if (path === '/strategy') {
    return (
      <ProtectedRoute>
        <StrategicAnalysisPage />
      </ProtectedRoute>
    );
  }
  if (/^\/strategy\/[^/]+$/.test(path)) {
    const id = path.replace('/strategy/', '');
    return (
      <ProtectedRoute>
        <StrategicAnalysisPage params={{ id }} />
      </ProtectedRoute>
    );
  }

  // Protected: Printable ICP Report
  if (path === '/icp/report' || /^\/icp\/report\/[^/]+$/.test(path)) {
    const id = path.replace('/icp/report/', '') || 'latest';
    return (
      <ProtectedRoute>
        <ICPReportPage params={{ id }} />
      </ProtectedRoute>
    );
  }

  // Protected: Settings & Configuration
  if (path === '/settings') {
    return (
      <ProtectedRoute>
        <SettingsPage />
      </ProtectedRoute>
    );
  }
  if (path === '/settings/billing') return <ProtectedRoute><BillingPage /></ProtectedRoute>;

  // Fallback
  return <NotFoundPage />;
}

function ScopedWorkspace() {
  const { user, isDemoUser } = useAuth();
  const scope = user?.id || (isDemoUser ? 'demo' : 'anonymous');
  return (
    <AppStoreProvider key={scope}>
      <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center font-mono text-sm" role="status">Opening FiguredIt…</div>}>
        <RouteSwitch />
      </React.Suspense>
      <UpgradeModal />
    </AppStoreProvider>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ScopedWorkspace />
      </AuthProvider>
    </Router>
  );
}
