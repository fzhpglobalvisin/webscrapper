// components/WebNavigator.tsx — Exclusive Single-Page Web Navigator Architecture
// 70/30 Focus Mode Layout, Dual-Source RAG Knowledge Context, Multimodal Voice & WhatsApp Lead Flow

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Globe, 
  ExternalLink, 
  RotateCw, 
  Search, 
  Send, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  FileText, 
  DollarSign, 
  ShieldCheck, 
  Database, 
  Columns, 
  Maximize2, 
  Trash2,
  HelpCircle,
  Building2,
  PanelLeftClose,
  PanelLeftOpen,
  Mic,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Award,
  Calendar,
  Tag,
  Phone,
  MessageCircle,
  Share2
} from 'lucide-react';
import { 
  BIEngineOutput, 
  DashboardState, 
  DatasetInfo, 
  Language, 
  SalesRecord, 
  ScrapedWebContext, 
  DualSourceQnAPair,
  ProjectAsset
} from '../types';
import { 
  fetchAndScrapeWebContext, 
  askDualSourceAdvisor 
} from '../services/webNavigatorService';
import { 
  DEFAULT_B2C_WEB_CONTEXT, 
  DEFAULT_B2C_RELATIONAL_MODEL, 
  B2C_REAL_ESTATE_UNITS 
} from '../services/b2cRealEstateData';
import { synthesizeB2CAutoFAQs, B2CAutoFAQ } from '../services/b2cFaqEngine';
import { MediaLightboxModal } from './MediaLightboxModal';
import { VoiceWhatsAppLeadCapture } from './VoiceWhatsAppLeadCapture';

export interface WebNavigatorProps {
  engine: BIEngineOutput;
  dashboardState: DashboardState;
  datasetInfo?: DatasetInfo;
  salesData?: SalesRecord[];
  language?: Language;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onUpdateWebContext?: (ctx: ScrapedWebContext) => void;
  onTriggerVoice?: () => void;
  isHeaderInSidebar?: boolean;
}

export const WebNavigator: React.FC<WebNavigatorProps> = ({
  engine,
  dashboardState,
  datasetInfo,
  salesData,
  language = Language.ENGLISH,
  isSidebarCollapsed,
  onToggleSidebar,
  onUpdateWebContext,
  onTriggerVoice,
  isHeaderInSidebar = true,
}) => {
  const defaultUrl = dashboardState.webContext?.url || 'https://saimabuilders.net/';
  const [inputUrl, setInputUrl] = useState(defaultUrl);
  const [currentUrl, setCurrentUrl] = useState(defaultUrl);
  const [viewMode, setViewMode] = useState<'proxy' | 'direct'>('proxy');
  const [activeTab, setActiveTab] = useState<'iframe' | 'dom' | 'matrix'>('iframe');
  
  // Split ratio: 'split' strictly enforces 70% Live Browser / 30% Copilot panel
  const [splitRatio, setSplitRatio] = useState<'split' | 'webOnly' | 'chatOnly'>('split');
  
  // Side Panel Multi-Channel tabs: 'copilot' | 'faqs' | 'assets' | 'lead'
  const [sideChannel, setSideChannel] = useState<'copilot' | 'faqs' | 'assets' | 'lead'>('copilot');

  // Scraping state
  const [webContext, setWebContext] = useState<ScrapedWebContext | null>(
    dashboardState.webContext || DEFAULT_B2C_WEB_CONTEXT
  );
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Chat Q&A state
  const [chatHistory, setChatHistory] = useState<DualSourceQnAPair[]>([]);
  const [questionInput, setQuestionInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Lightbox state for floor plans, blueprints, high-res photos
  const [lightboxAsset, setLightboxAsset] = useState<ProjectAsset | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // B2C Auto FAQs state in side panel
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [faqSearchQuery, setFaqSearchQuery] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-pricing-1');

  // Assets category in side panel
  const [assetCategory, setAssetCategory] = useState<string>('all');

  // Synthesize B2C FAQs
  const synthesizedFaqs: B2CAutoFAQ[] = useMemo(() => {
    return synthesizeB2CAutoFAQs(
      DEFAULT_B2C_RELATIONAL_MODEL,
      webContext || DEFAULT_B2C_WEB_CONTEXT,
      B2C_REAL_ESTATE_UNITS
    );
  }, [webContext]);

  // Filtered FAQs
  const filteredFaqs = useMemo(() => {
    return synthesizedFaqs.filter(faq => {
      const matchesCat = faqCategory === 'all' || faq.category === faqCategory;
      const q = faqSearchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        faq.question.toLowerCase().includes(q) || 
        faq.answer.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [synthesizedFaqs, faqCategory, faqSearchQuery]);

  // Project assets catalog
  const allProjectAssets = useMemo(() => {
    return webContext?.projectAssets || DEFAULT_B2C_WEB_CONTEXT.projectAssets || [];
  }, [webContext]);

  const filteredAssets = useMemo(() => {
    if (assetCategory === 'all') return allProjectAssets;
    return allProjectAssets.filter(a => a.category === assetCategory);
  }, [allProjectAssets, assetCategory]);

  // Listen for iframe communication messages (NAVIGATED_URL)
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATED_URL' && typeof event.data.url === 'string') {
        setCurrentUrl(event.data.url);
        setInputUrl(event.data.url);
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []);

  // Sync state to window for sidebar Web Navigator controls
  useEffect(() => {
    const syncPayload = {
      url: currentUrl,
      inputUrl: inputUrl,
      isScraping,
      splitRatio,
      viewMode,
      status: webContext?.status || 'active',
      wordCount: webContext?.wordCount || 0,
      title: webContext?.title || ''
    };
    window.dispatchEvent(new CustomEvent('web-navigator-state-sync', { detail: syncPayload }));
  }, [currentUrl, inputUrl, isScraping, splitRatio, viewMode, webContext]);

  // Listen for external controls
  useEffect(() => {
    const handleExtNav = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.url) {
        handleNavigateAndIngest(custom.detail.url);
      }
    };
    const handleExtSplit = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.splitRatio) {
        setSplitRatio(custom.detail.splitRatio);
      }
    };
    const handleExtViewMode = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.viewMode) {
        setViewMode(custom.detail.viewMode);
      }
    };
    const handleOpenWhatsAppLead = () => {
      setSideChannel('lead');
      setSplitRatio('split');
    };
    window.addEventListener('web-navigator-navigate', handleExtNav);
    window.addEventListener('web-navigator-split-ratio', handleExtSplit);
    window.addEventListener('web-navigator-view-mode', handleExtViewMode);
    window.addEventListener('open-whatsapp-lead-tab', handleOpenWhatsAppLead);
    return () => {
      window.removeEventListener('web-navigator-navigate', handleExtNav);
      window.removeEventListener('web-navigator-split-ratio', handleExtSplit);
      window.removeEventListener('web-navigator-view-mode', handleExtViewMode);
      window.removeEventListener('open-whatsapp-lead-tab', handleOpenWhatsAppLead);
    };
  }, [webContext]);

  // Auto-scroll chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAsking]);

  const handleNavigateAndIngest = async (targetUrl: string) => {
    if (!targetUrl.trim()) return;
    
    let cleanUrl = targetUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    setInputUrl(cleanUrl);
    setCurrentUrl(cleanUrl);
    setIsScraping(true);
    setScrapeError(null);

    try {
      const scraped = await fetchAndScrapeWebContext(cleanUrl);
      setWebContext(scraped);
      if (onUpdateWebContext) {
        onUpdateWebContext(scraped);
      }
    } catch (err: any) {
      setScrapeError(err?.message || 'Scraping failed');
    } finally {
      setIsScraping(false);
    }
  };

  const handleAskQuestion = async (presetQuestion?: string) => {
    const q = (presetQuestion || questionInput).trim();
    if (!q || isAsking) return;

    const newPairId = `qna-${Date.now()}`;
    const userPair: DualSourceQnAPair = {
      id: newPairId,
      question: q,
      answer: '',
      sources: ['web', 'excel'],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatHistory(prev => [...prev, userPair]);
    setQuestionInput('');
    setIsAsking(true);

    try {
      const response = await askDualSourceAdvisor({
        question: q,
        webContext: webContext || DEFAULT_B2C_WEB_CONTEXT,
        engine,
        dashboardState,
        datasetInfo,
        rawData: salesData,
        history: chatHistory,
        language,
      });

      setChatHistory(prev =>
        prev.map(item =>
          item.id === newPairId
            ? { 
                ...item, 
                answer: response.answer, 
                sources: response.sources,
                suggestedActions: response.suggestedActions,
                mediaAssets: response.mediaAssets,
              }
            : item
        )
      );
    } catch (err: any) {
      setChatHistory(prev =>
        prev.map(item =>
          item.id === newPairId
            ? {
                ...item,
                answer: `An error occurred while grounding response: ${err?.message || 'Unknown error'}`,
              }
            : item
        )
      );
    } finally {
      setIsAsking(false);
    }
  };

  const getIframeSrc = () => {
    if (viewMode === 'proxy') {
      return `/api/proxy-web-view?url=${encodeURIComponent(currentUrl)}`;
    }
    return currentUrl;
  };

  const openAssetLightbox = (asset: ProjectAsset) => {
    setLightboxAsset(asset);
    setIsLightboxOpen(true);
  };

  const suggestedPrompts = [
    'What are the 2-bed starting prices and payment schedules?',
    'Explain the 10% down payment and 80/20 post-handover plan',
    'Show me the luxury floor plans and square footage options',
    'Which units qualify for the 10-Year UAE Golden Visa?',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 overflow-hidden text-slate-800 dark:text-slate-100 relative">
      {/* ─── Unfrozen Sticky Top Header ───────────────────────────────────── */}
      {(!isHeaderInSidebar || isSidebarCollapsed) && (
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0 pointer-events-auto">
          <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Sidebar Toggle in Toolbar */}
            {onToggleSidebar && (
              <button
                type="button"
                id="webnav-sidebar-toggle-btn"
                onClick={onToggleSidebar}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                title={isSidebarCollapsed ? "Expand Navigation Sidebar" : "Collapse Sidebar (Focus Mode)"}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                )}
              </button>
            )}

            <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center shadow-2xs">
                <Globe className="w-4 h-4" />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <h2 className="text-xs font-bold tracking-tight text-slate-900 dark:text-white">
                    Live Web Navigator
                  </h2>
                  <span className="text-[9px] uppercase font-black tracking-wider px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    70/30 Focus
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-none">
                  Live DOM + Excel Grounded
                </p>
              </div>
            </div>

            {/* URL Input Form */}
            <form
              onSubmit={e => {
                e.preventDefault();
                handleNavigateAndIngest(inputUrl);
              }}
              className="flex items-center flex-1 max-w-xl bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition-all shadow-2xs"
            >
              <div className="pl-3 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
                placeholder="Enter URL to navigate & ingest (e.g. https://saimabuilders.net/)"
                className="w-full bg-transparent px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isScraping}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs px-3.5 py-1.5 flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Scraping...</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Ingest</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Grounding & Status Metrics */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {webContext?.status === 'active' && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Live DOM Ingested ({webContext.wordCount?.toLocaleString() || '1,400'} words)</span>
              </div>
            )}

            {/* Direct Proxy Stream Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
              <button
                type="button"
                onClick={() => setViewMode('proxy')}
                className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewMode === 'proxy'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Bypasses X-Frame-Options restrictions through secure reverse streaming"
              >
                Proxy Stream
              </button>
              <button
                type="button"
                onClick={() => setViewMode('direct')}
                className={`px-2 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  viewMode === 'direct'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Direct iframe loading (requires website iframe permissions)"
              >
                Direct
              </button>
            </div>

            {/* WhatsApp Brochure Lead Quick Tab Button */}
            <button
              type="button"
              onClick={() => {
                setSideChannel('lead');
                setSplitRatio('split');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
              title="Open WhatsApp Brochure & Lead Capture"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp Brochure</span>
            </button>

            {/* Multimodal Voice Trigger */}
            {onTriggerVoice && (
              <button
                type="button"
                onClick={onTriggerVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                title="Start Voice Assistant"
              >
                <Mic className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voice Assistant</span>
              </button>
            )}
          </div>
        </header>
      )}

      {/* ─── Main Focus Workspace (Strict 70% Live Browser / 30% Multi-Channel Panel) ─── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* LEFT COLUMN: Live Browser View & RAG Context Engine (Strict 70%) */}
        <div 
          className={`flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 ${
            splitRatio === 'split' 
              ? 'w-full md:w-[70%]' 
              : splitRatio === 'webOnly' 
                ? 'w-full' 
                : 'hidden'
          }`}
        >
          {/* Browser Navigation Sub-Toolbar */}
          <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
            {/* View Tabs */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('iframe')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'iframe'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Live Browser View</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('dom')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'dom'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Scraped DOM &amp; RAG Context</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Dual-Source Matrix</span>
              </button>
            </div>

            {/* Split Screen Control Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSplitRatio('split')}
                title="70% Browser / 30% Copilot Focus Mode"
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  splitRatio === 'split'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio('webOnly')}
                title="Full Screen Web Navigator"
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  splitRatio === 'webOnly'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-600 dark:bg-indigo-950 dark:border-indigo-800'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open live portal in new window"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Error Message if scraping or proxy failed */}
          {scrapeError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Web Ingestion Alert: {scrapeError}</span>
              </div>
              <button
                onClick={() => setScrapeError(null)}
                className="text-rose-500 hover:text-rose-700 font-bold px-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Subview 1: Live iFrame Browser Container */}
          {activeTab === 'iframe' && (
            <div className="flex-1 w-full h-full relative bg-slate-900 overflow-hidden">
              {isScraping && (
                <div className="absolute inset-0 z-10 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <p className="text-xs font-semibold tracking-wide">
                    Scraping live DOM structure &amp; indexing project assets...
                  </p>
                </div>
              )}
              <iframe
                id="web-navigator-live-frame"
                src={getIframeSrc()}
                title="Live Saima Builders Portal"
                className="w-full h-full border-0 bg-white"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                loading="eager"
              />
            </div>
          )}

          {/* Subview 2: Scraped DOM Structure & Grounding Knowledge Base */}
          {activeTab === 'dom' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white">
                      Target Domain: {webContext?.url || currentUrl}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Scraped at: {webContext?.scrapedAt || 'Active Session'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {webContext?.title || 'Saima Builders & Developers — Premier Real Estate Ingestion'}
                </p>
                {webContext?.metaDescription && (
                  <p className="text-[11px] text-slate-500 italic">
                    {webContext.metaDescription}
                  </p>
                )}
              </div>

              {/* Extracted Pricing & Installment Signals */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Real Estate Pricing &amp; Down Payment Grounding Signals</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(webContext?.pricingSignals || DEFAULT_B2C_WEB_CONTEXT.pricingSignals).map((sig, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{sig}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Indexed Project Features & Facts */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Verified Project Facts from Web Ingestion</span>
                </h4>
                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  {(webContext?.keyFacts || DEFAULT_B2C_WEB_CONTEXT.keyFacts).map((fact, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{fact}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scraped DOM Text Summary Preview */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Cleaned DOM Corpus (Fed directly into Gemini RAG System Prompt)</span>
                </h4>
                <div className="p-3 bg-slate-950 text-slate-200 rounded-xl font-mono text-[11px] max-h-60 overflow-y-auto leading-relaxed border border-slate-800">
                  {webContext?.sanitizedText || DEFAULT_B2C_WEB_CONTEXT.sanitizedText}
                </div>
              </div>
            </div>
          )}

          {/* Subview 3: Dual-Source Matrix (Web vs Excel Reconciliation) */}
          {activeTab === 'matrix' && (
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-950/40 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-indigo-950 dark:text-indigo-200">
                    Dual-Source Grounding Architecture
                  </h4>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    Merges live website pricing &amp; brochures with verified Excel inventory records.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-[10px]">
                    100% Deterministic
                  </span>
                </div>
              </div>

              {/* Comparison Matrix Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="p-3 font-bold">Project / Unit Dimension</th>
                      <th className="p-3 font-bold text-indigo-600 dark:text-indigo-400">
                        Source A: Live Web (saimabuilders.net)
                      </th>
                      <th className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                        Source B: Verified Excel Dataset
                      </th>
                      <th className="p-3 font-bold">RAG Reconciliation Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    <tr>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Starting Prices</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">AED 1.2M - 4.2M (Brochures &amp; Web signals)</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">
                        ${Math.round(Math.abs(engine.kpis.totalRevenue)).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Payment Schedules</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">10% Down Payment, 80/20 Post-Handover</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">
                        {Math.abs(engine.kpis.grossMargin).toFixed(1)}% margin baseline
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Outstanding &amp; Booking</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">10% Booking Deposit via Online Portal</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-mono">
                        ${Math.round(Math.abs(engine.kpis.totalOutstanding)).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                          <CheckCircle2 className="w-3 h-3" /> Reconciled
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Multi-Channel Side Panel (Strict 30%) */}
        <div 
          className={`flex flex-col bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${
            splitRatio === 'split' 
              ? 'w-full md:w-[30%]' 
              : splitRatio === 'chatOnly' 
                ? 'w-full' 
                : 'hidden'
          }`}
        >
          {/* Side Panel Channel Tab Selector Bar */}
          <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setSideChannel('copilot')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sideChannel === 'copilot'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Copilot</span>
              </button>

              <button
                type="button"
                onClick={() => setSideChannel('faqs')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sideChannel === 'faqs'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>B2C FAQs</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {synthesizedFaqs.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSideChannel('assets')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sideChannel === 'assets'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Plans</span>
                <span className="text-[9px] px-1 py-0.2 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {allProjectAssets.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSideChannel('lead')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  sideChannel === 'lead'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>

            {sideChannel === 'copilot' && chatHistory.length > 0 && (
              <button
                onClick={() => setChatHistory([])}
                title="Clear conversation"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* ── CHANNEL 1: AI COPILOT ──────────────────────────────────────── */}
          {sideChannel === 'copilot' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Dual Source Grounding Badge Banner */}
              <div className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 px-3 py-1.5 flex items-center justify-between text-[11px] shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {webContext ? new URL(webContext.finalUrl || webContext.url).hostname : 'saimabuilders.net'}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Database className="w-3 h-3" />
                    {datasetInfo?.name ? datasetInfo.name.slice(0, 14) : 'Real Estate DB'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  ${Math.round(Math.abs(engine.kpis.totalRevenue) / 1000)}k rev
                </span>
              </div>

              {/* Conversation Stream */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3.5 min-h-0 bg-slate-50 dark:bg-slate-900">
                {chatHistory.length === 0 && (
                  <div className="text-center py-6 px-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Real Estate Consumer Copilot
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                      Ask about prices, 10% down payment schedules, 80/20 post-handover terms, floor plans, or unit availability.
                    </p>

                    {/* Suggested Prompts */}
                    <div className="mt-4 space-y-1.5 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Frequently Inquired:
                      </span>
                      {suggestedPrompts.map((p, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleAskQuestion(p)}
                          className="w-full text-left p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-xs text-slate-700 dark:text-slate-300 font-medium transition-all shadow-2xs hover:translate-x-0.5 cursor-pointer"
                        >
                          {p}
                        </button>
                      ))}

                      {/* WhatsApp Quick Trigger Button */}
                      <button
                        onClick={() => setSideChannel('lead')}
                        className="w-full text-left p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 text-xs text-emerald-800 dark:text-emerald-300 font-semibold transition-all shadow-2xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Receive PDF brochure on WhatsApp (11-digit)
                        </span>
                        <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full">
                          Dispatch
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {chatHistory.map(item => (
                  <div key={item.id} className="space-y-2.5">
                    {/* User Message */}
                    <div className="flex justify-end">
                      <div className="max-w-[88%] bg-indigo-600 text-white rounded-2xl rounded-tr-xs px-3.5 py-2 text-xs shadow-xs">
                        <p className="font-medium leading-relaxed">{item.question}</p>
                        <span className="text-[9px] text-indigo-200 mt-1 block text-right">
                          {item.timestamp}
                        </span>
                      </div>
                    </div>

                    {/* Advisor Response */}
                    <div className="flex justify-start">
                      <div className="max-w-[96%] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-xs p-3.5 text-xs border border-slate-200 dark:border-slate-700 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                              Dual-Grounded Intelligence
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {item.sources.map(src => (
                              <span
                                key={src}
                                className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                  src === 'web'
                                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {src === 'web' ? 'Live Web' : 'Excel Model'}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Answer Text */}
                        <div className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line text-xs font-normal">
                          {item.answer}
                        </div>

                        {/* Media Assets (Floor Plans / Blueprints attached to answer) */}
                        {item.mediaAssets && item.mediaAssets.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                              Relevant Blueprint &amp; Media Attachments:
                            </span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {item.mediaAssets.map(asset => (
                                <div
                                  key={asset.id}
                                  onClick={() => openAssetLightbox(asset)}
                                  className="group relative rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden cursor-pointer bg-slate-900"
                                >
                                  <img
                                    src={asset.imageUrl}
                                    alt={asset.title}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-16 object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 transition-colors p-1.5 flex flex-col justify-between">
                                    <span className="text-[9px] text-white font-bold truncate">
                                      {asset.title}
                                    </span>
                                    <span className="text-[8px] text-indigo-300 font-medium">
                                      Click to inspect
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Suggested Follow-up Actions */}
                        {item.suggestedActions && item.suggestedActions.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap gap-1">
                            {item.suggestedActions.map((action, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAskQuestion(action)}
                                className="text-[10px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-700/70 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition-colors font-medium cursor-pointer"
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading Indicator */}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl rounded-tl-xs p-3 text-xs border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span className="font-medium">
                        Grounding pricing &amp; plans across Live DOM + verified database...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-2.5 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shrink-0">
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleAskQuestion();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={questionInput}
                    onChange={e => setQuestionInput(e.target.value)}
                    placeholder="Ask pricing, 10% down payment, floor plans..."
                    disabled={isAsking}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {onTriggerVoice && (
                    <button
                      type="button"
                      onClick={onTriggerVoice}
                      title="Speak question via voice"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors cursor-pointer"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isAsking || !questionInput.trim()}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── CHANNEL 2: B2C AUTO-GENERATED FAQS ────────────────────────── */}
          {sideChannel === 'faqs' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Category Filter Pills & Search */}
              <div className="p-2.5 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={faqSearchQuery}
                    onChange={e => setFaqSearchQuery(e.target.value)}
                    placeholder="Search pricing, plans, golden visa..."
                    className="w-full bg-slate-100 dark:bg-slate-900 pl-8 pr-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar">
                  {[
                    { id: 'all', label: 'All FAQs' },
                    { id: 'pricing', label: 'Pricing' },
                    { id: 'installments', label: 'Installments' },
                    { id: 'booking', label: 'Booking' },
                    { id: 'golden_visa', label: 'Golden Visa' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFaqCategory(tab.id)}
                      className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        faqCategory === tab.id
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FAQs Accordion List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-2 min-h-0">
                {filteredFaqs.map(faq => {
                  const isExpanded = expandedFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                        className="w-full p-3 text-left flex items-start justify-between gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                      >
                        <div className="space-y-1">
                          <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {faq.category.replace('_', ' ')}
                          </span>
                          <h5 className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                            {faq.question}
                          </h5>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                            {faq.answer}
                          </p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[9px] text-slate-400 font-mono">
                              Source: {faq.sources?.includes('web') && faq.sources?.includes('model') ? 'Web + Excel Grounded' : faq.sources?.includes('web') ? 'Live Web' : 'Excel Model'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSideChannel('copilot');
                                handleAskQuestion(`Can you elaborate more on: "${faq.question}"?`);
                              }}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                            >
                              Ask AI Follow-up →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── CHANNEL 3: PROJECT PLANS & BLUEPRINT ASSETS ─────────────────── */}
          {sideChannel === 'assets' && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Asset Category Bar */}
              <div className="p-3 bg-white dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1 overflow-x-auto text-[11px] shrink-0 no-scrollbar">
                {['all', 'floorplan', 'exterior', 'interior', 'amenity'].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAssetCategory(cat)}
                    className={`px-2 py-0.5 rounded-full font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      assetCategory === cat
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {cat === 'all' ? 'All Assets' : cat === 'floorplan' ? 'Floor Plans' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>

              {/* Assets Grid */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 min-h-0">
                {filteredAssets.map(asset => (
                  <div
                    key={asset.id}
                    className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-2xs hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
                  >
                    {/* Thumbnail Image */}
                    <div 
                      className="h-32 w-full bg-slate-950 relative overflow-hidden cursor-pointer"
                      onClick={() => openAssetLightbox(asset)}
                    >
                      <img
                        src={asset.imageUrl}
                        alt={asset.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/0 transition-colors flex items-center justify-center">
                        <span className="px-2 py-1 rounded-lg bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Maximize2 className="w-3 h-3" /> Inspect Lightbox
                        </span>
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-wider">
                        {asset.category}
                      </span>
                    </div>

                    {/* Information & Actions */}
                    <div className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 
                            className="font-bold text-xs text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600"
                            onClick={() => openAssetLightbox(asset)}
                          >
                            {asset.title}
                          </h5>
                          <span className="text-[10px] text-slate-500">{asset.projectName}</span>
                        </div>
                        {asset.specs?.startingPrice && (
                          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            {typeof asset.specs.startingPrice === 'number' 
                              ? `$${asset.specs.startingPrice.toLocaleString()}` 
                              : asset.specs.startingPrice}
                          </span>
                        )}
                      </div>

                      {asset.specs && (
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          {asset.specs.beds && <span>{asset.specs.beds}</span>}
                          {asset.specs.areaSqFt && <span>• {asset.specs.areaSqFt} sq ft</span>}
                          {asset.specs.deposit && <span>• {asset.specs.deposit} Down</span>}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => openAssetLightbox(asset)}
                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Inspect Blueprint
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSideChannel('copilot');
                            handleAskQuestion(`Tell me about ${asset.title} in ${asset.projectName} including price and payment terms.`);
                          }}
                          className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 text-[10px] font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          Ask AI
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CHANNEL 4: WHATSAPP LEAD CAPTURE & BROCHURE FLOW ──────────── */}
          {sideChannel === 'lead' && (
            <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-3">
              <VoiceWhatsAppLeadCapture
                webContext={webContext || undefined}
                onTriggerVoice={onTriggerVoice}
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── High-Resolution Media & Blueprint Lightbox Modal ─────────────── */}
      <MediaLightboxModal
        asset={lightboxAsset}
        isOpen={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        onNavigateToUrl={url => handleNavigateAndIngest(url)}
        onAskCopilotAboutAsset={asset => {
          setSideChannel('copilot');
          handleAskQuestion(`What is the pricing, square footage, and payment schedule for ${asset.title} at ${asset.projectName}?`);
        }}
      />
    </div>
  );
};

// Also export as WebNavigatorIframe for backwards compatibility
export const WebNavigatorIframe = WebNavigator;
export default WebNavigator;
