// App.tsx — Exclusive Single-Page Web Navigator Architecture
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { SalesRecord, Language, DashboardState, DatasetInfo } from './types';
import { NavigationProvider } from './context/NavigationContext';
import { WebNavigator } from './components/WebNavigator';
import VoiceAssistant from './components/VoiceAssistant';
import DataUploader from './components/DataUploader';
import { SocialShareBar } from './components/SocialShareBar';
import { 
  Globe, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Sun, 
  Moon, 
  Database, 
  Mic, 
  Share2, 
  Sparkles,
  MessageCircle,
  X,
  Upload
} from 'lucide-react';
import { computeBI } from './services/biEngine';
import { buildAIContext } from './services/aiContextBuilder';
import { 
  DEFAULT_B2C_RELATIONAL_MODEL, 
  DEFAULT_B2C_WEB_CONTEXT, 
  B2C_REAL_ESTATE_UNITS 
} from './services/b2cRealEstateData';

const App: React.FC = () => {
  // Grounding sales records (defaults to verified real estate dataset)
  const [salesData, setSalesData] = useState<SalesRecord[]>(B2C_REAL_ESTATE_UNITS);
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo>({
    name: 'Real_Estate_AI_Filled_Dataset_AI_KPI_Template_Final.xlsx',
    recordCount: B2C_REAL_ESTATE_UNITS.length,
    uploadedAt: 'Active Grounded Knowledge Base',
    sourceType: 'default',
    fileSize: '48.6 KB',
    dataModel: DEFAULT_B2C_RELATIONAL_MODEL
  });

  const [language, setLanguage] = useState<Language>(Language.AUTO);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Theme state: dark / light
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app-theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  // Sidebar collapsed state: defaults to collapsed on app load as requested
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return true; // Default collapsed on load
  });

  // Sync theme to DOM
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      localStorage.setItem('app-theme', theme);
    } catch (e) {}
  }, [theme]);

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
    } catch (e) {}
  }, [isSidebarCollapsed]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  // Dashboard state for Web Navigator
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    filter: {},
    activeTab: 'webNavigator',
    webContext: DEFAULT_B2C_WEB_CONTEXT,
    whatsAppLead: {
      phoneNumber: '',
      userName: '',
      dispatched: false
    }
  });

  // Dynamic BI KPIs calculation
  const engine = useMemo(() => {
    return computeBI(salesData);
  }, [salesData]);

  // Voice AI Context string
  const aiContext = useMemo(() => {
    return buildAIContext(
      engine,
      dashboardState,
      datasetInfo,
      salesData
    );
  }, [engine, dashboardState, datasetInfo, salesData]);

  const handleDataLoaded = useCallback((records: SalesRecord[], info: DatasetInfo) => {
    setSalesData(records);
    setDatasetInfo(info);
  }, []);

  const handleUpdateWebContext = useCallback((scraped: any) => {
    setDashboardState(prev => ({
      ...prev,
      webContext: scraped
    }));
  }, []);

  const handleOpenWhatsAppLead = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open-whatsapp-lead-tab'));
    }
  }, []);

  return (
    <NavigationProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        {/* ─── Sleek Collapsible Left Sidebar ──────────────────────────────── */}
        <aside 
          className={`flex flex-col bg-slate-900 text-white border-r border-slate-800 transition-all duration-300 z-30 shrink-0 ${
            isSidebarCollapsed ? 'w-16 items-center' : 'w-64'
          }`}
        >
          {/* Sidebar Top: Logo, Brand & Collapse Button */}
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-slate-800/80 w-full shrink-0">
            {isSidebarCollapsed ? (
              <button
                type="button"
                onClick={toggleSidebar}
                className="w-9 h-9 mx-auto rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 flex items-center justify-center transition-all cursor-pointer"
                title="Expand Navigation Sidebar"
              >
                <span className="font-black text-sm tracking-tighter text-indigo-400">az</span>
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center font-black text-white shadow-xs shrink-0">
                    az
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-bold text-sm leading-tight tracking-tight text-white truncate">
                      az AI Sales
                    </h1>
                    <p className="text-[10px] text-indigo-300/80 leading-none">
                      Web Navigator
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Active Grounded Dataset Status (From Header) */}
          {isSidebarCollapsed ? (
            <div className="pt-2 px-2 w-full flex justify-center shrink-0">
              <div 
                className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-emerald-400 shadow-2xs"
                title={`${datasetInfo.name} (${salesData.length}/${salesData.length} records)`}
              >
                <Database className="w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="pt-2.5 px-3 w-full shrink-0">
              <div 
                className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs shadow-2xs"
                title={datasetInfo.name}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-5 h-5 rounded-md bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center shrink-0">
                    <Database className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="truncate text-[11px] font-mono text-slate-200">
                    {datasetInfo.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0">
                  {salesData.length}/{salesData.length}
                </span>
              </div>
            </div>
          )}

          {/* Navigation Item & Workspace Actions */}
          <div className="flex-1 py-3 px-2 w-full space-y-3 overflow-y-auto no-scrollbar">
            {isSidebarCollapsed ? (
              <button
                type="button"
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs"
                title="Web Navigator (Active 70/30 Focus Mode)"
              >
                <Globe className="w-4 h-4" />
              </button>
            ) : (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                  Navigation
                </span>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-xs transition-all"
                >
                  <Globe className="w-4 h-4 text-white" />
                  <div className="text-left flex-1">
                    <p className="leading-tight">Web Navigator</p>
                    <p className="text-[10px] text-indigo-200 font-normal">70/30 Focus Mode</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                </button>
              </div>
            )}

            {/* Quick Actions & Channels Section (WhatsApp Brochure + Voice Assistant + Import + Share) */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              {!isSidebarCollapsed && (
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">
                  Actions & Channels
                </span>
              )}

              {/* WhatsApp Brochure Button (From Header) */}
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={handleOpenWhatsAppLead}
                  className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                  title="WhatsApp Brochure & Lead Dispatch"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenWhatsAppLead}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-700/60 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="flex-1 text-left">WhatsApp Brochure</span>
                </button>
              )}

              {/* Multimodal Voice Trigger (From Header) */}
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsVoiceActive(prev => !prev)}
                  className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl text-white shadow-xs transition-all cursor-pointer active:scale-95 ${
                    isVoiceActive ? 'bg-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/40' : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                  title={isVoiceActive ? "Voice Assistant (Active)" : "Activate Voice Assistant"}
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsVoiceActive(prev => !prev)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95 ${
                    isVoiceActive
                      ? 'bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500/40'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    <Mic className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="flex-1 text-left">Voice Assistant</span>
                  {isVoiceActive ? (
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="text-[10px] text-indigo-200 uppercase font-bold">Live</span>
                  )}
                </button>
              )}

              {/* Data Import Button */}
              <DataUploader
                variant="sidebar"
                isCollapsed={isSidebarCollapsed}
                onDataLoaded={handleDataLoaded}
              />

              {/* Share Button */}
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Share Live Workspace"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <span>Share Portal</span>
                </button>
              )}
            </div>
          </div>

          {/* Sidebar Bottom: Controls & Profile (Theme Toggle + User Avatar from Header) */}
          <div className="p-3 border-t border-slate-800/80 w-full space-y-2 shrink-0">
            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-10 h-10 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-800"
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                </button>
                <div 
                  className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold text-xs shadow-xs"
                  title="Advisor (JD)"
                >
                  JD
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      JD
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-white">Advisor</p>
                      <p className="text-[10px] text-slate-400">Active Grounding</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700/50"
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ─── Main Content Canvas: Full-Height Web Navigator View ─────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {/* Root Component: WebNavigator (70/30 Focus Mode) */}
          <div className="flex-1 overflow-hidden relative">
            <WebNavigator
              engine={engine}
              dashboardState={dashboardState}
              datasetInfo={datasetInfo}
              salesData={salesData}
              language={language}
              isSidebarCollapsed={isSidebarCollapsed}
              onToggleSidebar={toggleSidebar}
              onUpdateWebContext={handleUpdateWebContext}
              onTriggerVoice={() => setIsVoiceActive(true)}
              isHeaderInSidebar={false}
            />
          </div>
        </main>

        {/* ─── Multimodal Voice Assistant Overlay ────────────────────────── */}
        <VoiceAssistant
          language={language}
          dataContext={aiContext}
          onUpdateDashboard={setDashboardState}
          externalActive={isVoiceActive}
          onExternalClose={() => setIsVoiceActive(false)}
        />

        {/* ─── Social Media Sharing Modal ─────────────────────────────────── */}
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-700 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Share az AI Sales
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Share the live Web Navigator portal with partners
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <SocialShareBar
                appTitle="az AI Sales — Web Navigator & Real Estate Advisor"
                shareUrl={typeof window !== 'undefined' ? window.location.href : 'https://saimabuilders.net/'}
                variant="bar"
              />

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </NavigationProvider>
  );
};

export default App;
