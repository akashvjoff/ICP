import React, { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAppStore } from '../../lib/store';
import { Toast } from '../ui/Toast';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { toasts, removeToast } = useAppStore();

  return (
    <div className="min-h-screen bg-[#F9F8F4] text-[#0A0A0A] flex flex-col lg:flex-row font-sans selection:bg-[#A1F000] selection:text-[#0A0A0A]">
      <AppSidebar />
      <main className="flex-1 min-w-0 p-6 sm:p-8 lg:p-10 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {/* Global Toast Stack */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              message={toast.text}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
