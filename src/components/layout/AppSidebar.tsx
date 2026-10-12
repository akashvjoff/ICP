import React, { useState } from 'react';
import { useRouter } from '../../lib/router';
import { useAppStore } from '../../lib/store';
import { useAuth } from '../../lib/auth';
import { BrutalistButton } from '../ui/BrutalistButton';
import { StickerBadge } from '../ui/StickerBadge';
import {
  LayoutDashboard,
  UploadCloud,
  Building2,
  GitFork,
  FileText,
  Settings,
  Sparkles,
  ArrowRight,
  Menu,
  X,
  ExternalLink,
  LogOut,
} from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

export const AppSidebar: React.FC = () => {
  const { path, navigate } = useRouter();
  const { isDemoMode, toggleDemoMode, user: storeUser, datasets, activeDatasetId, addToast } = useAppStore();
  const { workspaceUser, signOut, isDemoUser, isConfigured } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentUser = {
    name: workspaceUser?.name || storeUser.name,
    email: workspaceUser?.email || storeUser.email,
    company: storeUser.company,
  };

  const handleSignOut = async () => {
    await signOut();
    addToast('Signed out of workspace.', 'info');
    navigate('/auth');
  };

  const reportPath = datasets.length > 0
    ? `/icp/report/${activeDatasetId || datasets[0].id}`
    : '/icp/report/demo';

  const menuItems: SidebarItem[] = [
    { id: 'dashboard', label: 'OVERVIEW', path: '/dashboard', icon: LayoutDashboard },
    { id: 'uploads', label: 'UPLOADS', path: '/uploads/new', icon: UploadCloud, tag: 'WIZARD' },
    { id: 'companies', label: 'COMPANIES', path: '/companies', icon: Building2 },
    { id: 'segments', label: 'SEGMENTS', path: '/segments', icon: GitFork },
    { id: 'icp-report', label: 'ICP REPORT', path: reportPath, icon: FileText, tag: 'PRO' },
    { id: 'settings', label: 'SETTINGS', path: '/settings', icon: Settings },
  ];

  const handleNav = (targetPath: string) => {
    navigate(targetPath);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden sticky top-0 z-40 bg-[#F9F8F4] border-b-[3px] border-[#0A0A0A] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 font-black text-xl tracking-tighter text-[#0A0A0A]"
        >
          <span className="w-3 h-3 bg-[#A1F000] border-[1.5px] border-[#0A0A0A] inline-block shadow-[1px_1px_0px_#0A0A0A]" />
          <span>icp<span className="text-[#A1F000]">.</span>mode</span>
        </button>

        <div className="flex items-center gap-2">
          {isDemoMode && (
            <span className="font-mono text-[10px] font-bold bg-[#A1F000] px-2 py-0.5 rounded border border-[#0A0A0A]">
              DEMO
            </span>
          )}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 border-[2px] border-[#0A0A0A] rounded-lg bg-white shadow-[2px_2px_0px_#0A0A0A]"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-5 h-5 text-[#0A0A0A]" /> : <Menu className="w-5 h-5 text-[#0A0A0A]" />}
          </button>
        </div>
      </div>

      {/* Desktop Left Sidebar & Mobile Drawer */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-40
          h-screen w-72 shrink-0
          bg-[#F9F8F4]
          border-r-[3.5px] border-[#0A0A0A]
          flex flex-col justify-between
          transition-transform duration-200 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full overflow-y-auto p-5 sm:p-6">
          {/* Top Wordmark & Engine Tag */}
          <div className="border-b-[2.5px] border-[#0A0A0A] pb-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => handleNav('/')}
                className="flex items-center text-left cursor-pointer group"
              >
                <span className="text-2xl font-black tracking-tighter text-[#0A0A0A] group-hover:text-[#8C6ADE] transition-colors">
                  icp<span className="text-[#A1F000]">.</span>mode
                </span>
              </button>

              <button
                onClick={() => setMobileOpen(false)}
                className="lg:hidden p-1 text-[#0A0A0A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#A1F000] border-[1.5px] border-[#0A0A0A] shadow-[1px_1px_0px_#0A0A0A]" />
              <span className="font-mono text-[10px] font-black uppercase tracking-widest text-[#0A0A0A]">
                THE CUSTOMER-FIT ENGINE
              </span>
            </div>
          </div>

          {/* Quick Action: Upload Leads */}
          <div className="mb-6">
            <BrutalistButton
              variant="lime"
              size="md"
              onClick={() => handleNav('/uploads/new')}
              className="w-full text-xs font-black tracking-wider"
              icon={<UploadCloud className="w-4 h-4" />}
            >
              UPLOAD LEADS
            </BrutalistButton>
          </div>

          {/* Nav Items List */}
          <nav className="space-y-2 flex-1">
            <span className="font-mono text-[10px] font-black uppercase tracking-wider text-[#0A0A0A]/60 px-2 block mb-2">
              NAVIGATION
            </span>

            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = path === item.path || (item.id === 'icp-report' && path.startsWith('/icp/report'));

              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  className={`
                    w-full flex items-center justify-between
                    px-3.5 py-2.5 rounded-xl
                    border-[2px] border-[#0A0A0A]
                    font-mono text-xs font-bold tracking-wider
                    transition-all duration-120 cursor-pointer select-none text-left
                    ${isActive
                      ? 'bg-[#A1F000] text-[#0A0A0A] shadow-[3px_3px_0px_#0A0A0A] translate-x-1 font-black'
                      : 'bg-white text-[#0A0A0A] shadow-[2px_2px_0px_#0A0A0A] hover:bg-[#FFE3B3]/40'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                        w-7 h-7 rounded-full border-[1.5px] border-[#0A0A0A] flex items-center justify-center shrink-0
                        ${isActive ? 'bg-white text-[#0A0A0A]' : 'bg-[#E4E6FB] text-[#0A0A0A]'}
                      `}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span>{item.label}</span>
                  </div>

                  {item.tag && (
                    <span className="text-[9px] font-black bg-white px-1.5 py-0.5 rounded border border-[#0A0A0A]">
                      {item.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Card: Demo Mode Banner & User Profile */}
          <div className="pt-5 border-t-[2.5px] border-[#0A0A0A] space-y-3 mt-4">
            <div className="bg-[#FFE3B3] border-[2px] border-[#0A0A0A] rounded-xl p-3 shadow-[2px_2px_0px_#0A0A0A]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] font-black uppercase text-[#0A0A0A]">
                  DATASET STATE
                </span>
                <span className={`font-mono text-[9px] font-black px-1.5 py-0.2 rounded border border-[#0A0A0A] ${
                  isDemoMode ? 'bg-[#A1F000]' : 'bg-white'
                }`}>
                  {isDemoMode ? 'DEMO' : 'LIVE'}
                </span>
              </div>
              <p className="text-[11px] text-[#0A0A0A]/80 font-medium leading-tight mb-2">
                {isDemoMode ? 'Synthetic B2B dataset loaded for test drives.' : 'Live data pipeline waiting for CSV upload.'}
              </p>
              <button
                onClick={toggleDemoMode}
                className="w-full text-center font-mono text-[10px] font-black text-[#0A0A0A] bg-white border border-[#0A0A0A] py-1 rounded hover:bg-[#A1F000] transition-colors cursor-pointer"
              >
                {isDemoMode ? 'SWITCH TO BLANK MODE' : 'RESTORE DEMO DATA'}
              </button>
            </div>

            {/* User profile snippet */}
            <div className="flex items-center justify-between bg-white border-[2px] border-[#0A0A0A] p-2.5 rounded-xl shadow-[2px_2px_0px_#0A0A0A]">
              <div className="flex items-center gap-2.5 truncate min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#E5F7E5] border-[1.5px] border-[#0A0A0A] font-mono text-xs font-black flex items-center justify-center shrink-0">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="truncate min-w-0">
                  <div className="font-mono text-xs font-black text-[#0A0A0A] truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-[#0A0A0A]/60 font-semibold truncate">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleNav('/onboarding')}
                  title="Edit Seller Profile"
                  className="p-1 hover:bg-[#FFE3B3] rounded border border-transparent hover:border-[#0A0A0A] cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#0A0A0A]" />
                </button>
                <button
                  onClick={handleSignOut}
                  title="Sign Out"
                  className="p-1 hover:bg-[#FFB6C2] rounded border border-transparent hover:border-[#0A0A0A] cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-[#0A0A0A]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-[#0A0A0A]/50 backdrop-blur-xs"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
};
