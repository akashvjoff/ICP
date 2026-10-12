/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Router, useRouter } from './lib/router';
import { AuthProvider } from './lib/auth';
import { AppStoreProvider } from './lib/store';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadWizardPage } from './pages/UploadWizardPage';
import { DatasetDetailsPage } from './pages/DatasetDetailsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { CompanyProfilePage } from './pages/CompanyProfilePage';
import { SegmentsPage } from './pages/SegmentsPage';
import { ICPReportPage } from './pages/ICPReportPage';
import { SettingsPage } from './pages/SettingsPage';

function RouteSwitch() {
  const { path } = useRouter();

  // Public Root Landing
  if (path === '/' || path === '') {
    return <LandingPage />;
  }

  // Auth & Onboarding
  if (path === '/auth') {
    return <AuthPage />;
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
  if (path.startsWith('/uploads/')) {
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
  if (path.startsWith('/companies/')) {
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

  // Protected: Printable ICP Report
  if (path.startsWith('/icp/report')) {
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

  // Fallback
  return (
    <ProtectedRoute>
      <DashboardPage />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppStoreProvider>
          <RouteSwitch />
        </AppStoreProvider>
      </AuthProvider>
    </Router>
  );
}
