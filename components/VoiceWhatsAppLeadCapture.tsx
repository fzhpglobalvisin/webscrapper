import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Phone, 
  User, 
  Send, 
  CheckCircle2, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2, 
  ExternalLink, 
  Copy, 
  Check, 
  AlertCircle, 
  Loader2, 
  FileText, 
  ChevronDown, 
  ChevronUp,
  Building,
  RefreshCw
} from 'lucide-react';
import { ScrapedWebContext } from '../types';
import { capture_whatsapp_lead } from '../services/gemini';

interface VoiceWhatsAppLeadCaptureProps {
  webContext?: ScrapedWebContext;
  onTriggerVoice?: () => void;
  initialPhoneNumber?: string;
  initialUserName?: string;
  className?: string;
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', nought: '0', oh: '0', sifar: '0',
  one: '1', ek: '1',
  two: '2', do: '2',
  three: '3', teen: '3',
  four: '4', char: '4',
  five: '5', panch: '5',
  six: '6', chhe: '6',
  seven: '7', saat: '7',
  eight: '8', aath: '8',
  nine: '9', nau: '9'
};

export const VoiceWhatsAppLeadCapture: React.FC<VoiceWhatsAppLeadCaptureProps> = ({
  webContext,
  onTriggerVoice,
  initialPhoneNumber = '',
  initialUserName = '',
  className = ''
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhoneNumber);
  const [userName, setUserName] = useState<string>(initialUserName);
  const [selectedProject, setSelectedProject] = useState<string>(
    'Saima Luxury Towers & Marina Heights — Complete Grounded Portfolio'
  );
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedBrochure, setCopiedBrochure] = useState<boolean>(false);
  const [showBrochurePreview, setShowBrochurePreview] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    status: string;
    waMeLink: string;
    voiceConfirmation: string;
    brochure: { title: string; text: string; sections: any };
    recipient: { name: string; phoneNumber: string; formattedLocal: string };
  } | null>(null);

  const recognitionRef = useRef<any>(null);

  // Normalize phone digits
  const cleanDigits = phoneNumber.replace(/\D/g, '');
  const isValid11 = cleanDigits.startsWith('0') && cleanDigits.length === 11;
  const isTooLong = cleanDigits.length > 11;
  const digitsCount = cleanDigits.length;

  // Speak voice confirmation back to user using Web Speech API
  const speakFeedback = useCallback((text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis unavailable:', e);
      }
    }
  }, []);

  // Dispatch brochure to /api/send-whatsapp-brochure
  const handleDispatchBrochure = useCallback(async (phoneToUse?: string, nameToUse?: string) => {
    const finalPhone = (phoneToUse || phoneNumber).trim();
    const finalName = (nameToUse || userName).trim() || 'Valued Client';

    const digitsOnly = finalPhone.replace(/\D/g, '');
    if (!digitsOnly || digitsOnly.length < 10) {
      setDispatchError('Please enter an 11-digit WhatsApp number starting with 0.');
      return;
    }

    setIsDispatching(true);
    setDispatchError(null);

    try {
      const response = await fetch('/api/send-whatsapp-brochure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: finalPhone,
          name: finalName,
          userName: finalName,
          project: selectedProject,
          includeFaqs: true,
          includePaymentPlans: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to dispatch brochure`);
      }

      const data = await response.json();
      setDispatchResult(data);
      
      const confirmText = data.voiceConfirmation || 
        `Got it, ${finalName}. I have your number as ${data.recipient?.phoneNumber || finalPhone}. Sending your brochure now!`;
      
      setFeedbackNotice(confirmText);
      speakFeedback(confirmText);

    } catch (err: any) {
      console.error('Failed to dispatch brochure:', err);
      setDispatchError(err.message || 'Error compiling & sending WhatsApp brochure.');
    } finally {
      setIsDispatching(false);
    }
  }, [phoneNumber, userName, selectedProject, speakFeedback]);

  // Listen for Gemini Live Voice capture events
  useEffect(() => {
    const handleGeminiLeadEvent = (e: any) => {
      const detail = e.detail;
      if (detail && detail.phoneNumber) {
        setPhoneNumber(detail.phoneNumber);
        if (detail.userName) setUserName(detail.userName);
        
        const confirmMsg = `Got it, ${detail.userName || 'Client'}. I have your number as ${detail.phoneNumber}. Sending your brochure now!`;
        setFeedbackNotice(confirmMsg);
        speakFeedback(confirmMsg);

        // Auto trigger backend dispatch
        handleDispatchBrochure(detail.phoneNumber, detail.userName);
      }
    };

    window.addEventListener('gemini-whatsapp-lead', handleGeminiLeadEvent);
    return () => {
      window.removeEventListener('gemini-whatsapp-lead', handleGeminiLeadEvent);
    };
  }, [handleDispatchBrochure, speakFeedback]);

  // Voice Speech-to-Text Parsing for slow digit-by-digit or full phrase dictation
  const handleToggleDictation = () => {
    if (isDictating) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsDictating(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onTriggerVoice) {
        onTriggerVoice();
      } else {
        alert('Web Speech API is not supported in this browser. Please use the Gemini Sales Voice Advisor button.');
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsDictating(true);
        setLiveTranscript('Listening for WhatsApp number and name...');
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        setLiveTranscript(transcript);

        // 1. Process words to numbers for slow digit dictation
        const lower = transcript.toLowerCase();
        let normalized = lower;
        Object.entries(NUMBER_WORDS).forEach(([word, digit]) => {
          const reg = new RegExp(`\\b${word}\\b`, 'gi');
          normalized = normalized.replace(reg, digit);
        });

        // 2. Extract digits
        const extractedDigits = normalized.replace(/\D/g, '');
        if (extractedDigits.length > 0) {
          // If starting with 0 and up to 11 digits
          const validPrefix = extractedDigits.startsWith('0') 
            ? extractedDigits.slice(0, 11) 
            : ('0' + extractedDigits).slice(0, 11);
          setPhoneNumber(validPrefix);
        }

        // 3. Extract Name: look for words after digits or "name is", "followed by", "i am"
        const nameMatch = lower.match(/(?:name is|followed by|this is|i am|for)\s+([a-z\s]+)/i);
        if (nameMatch && nameMatch[1]) {
          const cleanedName = nameMatch[1].replace(/phone|number|whatsapp|zero|one|two|three|four|five|six|seven|eight|nine|\d/gi, '').trim();
          if (cleanedName.length > 1) {
            const formatted = cleanedName.split(' ')
              .filter(Boolean)
              .map(w => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            setUserName(formatted);
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
        setLiveTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();

    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      setIsDictating(false);
    }
  };

  const handleCopyLink = () => {
    if (dispatchResult?.waMeLink) {
      navigator.clipboard.writeText(dispatchResult.waMeLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyBrochure = () => {
    if (dispatchResult?.brochure?.text) {
      navigator.clipboard.writeText(dispatchResult.brochure.text);
      setCopiedBrochure(true);
      setTimeout(() => setCopiedBrochure(false), 2500);
    }
  };

  return (
    <div 
      id="voice-whatsapp-lead-capture-card" 
      className={`bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden ${className}`}
    >
      {/* Top Banner with Conversational Prompting */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 p-5 md:p-6 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Voice-Driven WhatsApp Lead Capture & Auto-Brochure Dispatch
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-slate-200">
                Direct Developer Link
              </span>
            </div>
            
            <h3 className="text-lg md:text-xl font-extrabold text-white flex items-center gap-2">
              <span>Instant Digital Brochure via WhatsApp</span>
            </h3>

            {/* Exact Prompt Mandated by Requirement */}
            <div className="p-3 bg-emerald-950/60 rounded-xl border border-emerald-500/30 mt-2 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 text-emerald-300">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wide">
                  AI Voice Assistant Conversational Prompt:
                </p>
                <p className="text-xs md:text-sm font-bold text-white italic mt-0.5">
                  "Please state your 11-digit WhatsApp number starting with 0, followed by your name."
                </p>
              </div>
            </div>
          </div>

          {/* Quick Voice Triggers */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="voice-dictate-form-btn"
              onClick={handleToggleDictation}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer ${
                isDictating 
                  ? 'bg-rose-600 text-white animate-pulse' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title="Dictate 11-digit number slowly digit-by-digit followed by your name"
            >
              {isDictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isDictating ? 'Stop Listening' : 'Dictate Number & Name'}</span>
            </button>

            {onTriggerVoice && (
              <button
                id="voice-advisor-full-btn"
                onClick={onTriggerVoice}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
                title="Launch Gemini Live Voice Sales Advisor"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Live Voice Session</span>
              </button>
            )}
          </div>
        </div>

        {/* Live speech feedback if dictating */}
        {isDictating && (
          <div className="mt-3 p-2.5 bg-black/40 rounded-lg border border-emerald-400/40 text-xs text-emerald-300 flex items-center justify-between animate-pulse">
            <span className="font-mono">{liveTranscript || 'Listening... Speak digits slowly: "0-3-0-0-1-2-3-4-5-6-7 followed by [Your Name]"'}</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Microphone Active</span>
          </div>
        )}
      </div>

      {/* Main Form Body */}
      <div className="p-5 md:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Phone Number Field with 11-digit visual counter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="lead-phone-input" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>11-Digit WhatsApp Number (Starting with 0)</span>
              </label>
              
              {/* Visual Character Count Badge */}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                isValid11 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700' 
                  : cleanDigits.length === 0
                  ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  : cleanDigits.startsWith('0')
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
              }`}>
                {digitsCount}/11 digits {isValid11 ? '✓ Complete' : cleanDigits.startsWith('0') ? '• in progress' : '• Must start with 0'}
              </span>
            </div>

            <div className="relative">
              <input
                id="lead-phone-input"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. 03001234567"
                maxLength={14}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border rounded-xl text-sm font-mono tracking-wider text-slate-900 dark:text-white focus:outline-none transition-colors ${
                  isValid11 
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20' 
                    : isTooLong
                    ? 'border-rose-400 bg-rose-50/20 dark:bg-rose-950/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
                }`}
              />

              {isValid11 && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              )}
            </div>

            {/* Digit-by-digit visual character slots */}
            <div className="pt-1 flex items-center gap-1 overflow-x-auto">
              {Array.from({ length: 11 }).map((_, idx) => {
                const char = cleanDigits[idx] || '';
                const isFirst = idx === 0;
                const isFilled = Boolean(char);
                const isCorrectFirst = isFirst && char === '0';
                const isWrongFirst = isFirst && isFilled && char !== '0';

                return (
                  <div 
                    key={idx}
                    className={`w-7 h-8 rounded-md flex flex-col items-center justify-center text-xs font-mono font-bold transition-all border ${
                      isWrongFirst
                        ? 'bg-rose-100 border-rose-300 text-rose-700'
                        : isCorrectFirst
                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                        : isFilled
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                        : 'bg-slate-100 border-slate-200 text-slate-300'
                    }`}
                  >
                    <span>{char || '·'}</span>
                    <span className="text-[8px] text-slate-400 -mt-0.5">{idx + 1}</span>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500">
              Supports slow voice dictation: say numbers one by one (e.g. <em>"zero three zero zero..."</em>).
            </p>
          </div>

          {/* Full Name & Project Selection */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="lead-name-input" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Full Name</span>
              </label>
              <input
                id="lead-name-input"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Tariq Mahmood"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="lead-project-select" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Target Project / Portfolio</span>
              </label>
              <select
                id="lead-project-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Saima Luxury Towers & Marina Heights — Complete Grounded Portfolio">
                  Saima Luxury Towers & Marina Heights (All Inventory & Plans)
                </option>
                <option value="Azure Palms Luxury Residences (80/20 Post-Handover Plan)">
                  Azure Palms Residences (80/20 Post-Handover)
                </option>
                <option value="Coral Residence & Sky Villas (10-Year Golden Visa Eligible)">
                  Coral Residence & Sky Villas (10-Year Golden Visa)
                </option>
                <option value="Saima Executive Penthouses & Duplexes Collection">
                  Saima Executive Penthouses & Duplexes
                </option>
              </select>
            </div>
          </div>
        </div>

        {/* Validation Notice Feedback Banner mandated by requirement */}
        {feedbackNotice && (
          <div 
            id="voice-validation-feedback-box" 
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] uppercase font-black text-emerald-800 tracking-wider">
                  Voice Assistant Validation Feedback:
                </p>
                <p className="text-sm font-bold text-emerald-950 mt-0.5">
                  "{feedbackNotice}"
                </p>
              </div>
            </div>

            <button
              onClick={() => speakFeedback(feedbackNotice)}
              className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Re-play spoken feedback"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error message */}
        {dispatchError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{dispatchError}</span>
          </div>
        )}

        {/* Dispatch Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>Includes: Top B2C FAQs • Verified Pricing Tiers • 80/20 Payment Plans • Grounded Specs</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              id="clear-lead-form-btn"
              type="button"
              onClick={() => {
                setPhoneNumber('');
                setUserName('');
                setFeedbackNotice(null);
                setDispatchResult(null);
              }}
              className="px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Form
            </button>

            <button
              id="dispatch-whatsapp-brochure-btn"
              type="button"
              onClick={() => handleDispatchBrochure()}
              disabled={isDispatching || !phoneNumber}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                isDispatching || !phoneNumber
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
              }`}
            >
              {isDispatching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Compiling & Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Dispatch WhatsApp Brochure</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Box with wa.me Direct Link & Brochure Preview */}
        {dispatchResult && (
          <div className="p-5 bg-slate-50 rounded-2xl border border-emerald-200 space-y-4 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Brochure Package Dispatched & Ready
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Recipient: <strong className="text-slate-800">{dispatchResult.recipient.name}</strong> • Phone: <strong className="font-mono text-emerald-700">{dispatchResult.recipient.formattedLocal}</strong>
                  </p>
                </div>
              </div>

              {/* Direct WhatsApp Buttons */}
              <div className="flex items-center gap-2">
                <a
                  id="open-whatsapp-link-btn"
                  href={dispatchResult.waMeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open WhatsApp Direct (wa.me)</span>
                </a>

                <button
                  id="copy-wa-link-btn"
                  onClick={handleCopyLink}
                  className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs transition-colors cursor-pointer"
                  title="Copy Direct WhatsApp link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Collapsible Compiled Brochure Preview */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowBrochurePreview(prev => !prev)}
                  className="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showBrochurePreview ? 'Hide' : 'View'} Compiled WhatsApp Brochure Text</span>
                  {showBrochurePreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showBrochurePreview && (
                  <button
                    onClick={handleCopyBrochure}
                    className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedBrochure ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedBrochure ? 'Copied' : 'Copy Text'}</span>
                  </button>
                )}
              </div>

              {showBrochurePreview && (
                <div className="mt-3 p-4 bg-white rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed shadow-inner">
                  {dispatchResult.brochure.text}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
