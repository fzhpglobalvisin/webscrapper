import React, { useState, useRef, useCallback, useEffect } from 'react';
import { getVoiceSession } from '../services/gemini';
import { Mic, MicOff, X, MessageCircle, PhoneOff, ChevronDown, Loader2 } from 'lucide-react';
import { LiveServerMessage, Blob as GenAIBlob } from '@google/genai';
import { Language, DashboardState } from '../types';
import { normalizeTabId, TAB_DIRECTORY } from '../context/NavigationContext';
import { executeVoiceClick, executeVoiceInput, executeVoiceScroll } from '../services/voiceClickEngine';

interface VoiceAssistantProps {
  language: string;
  dataContext: string;
  onUpdateDashboard: React.Dispatch<React.SetStateAction<DashboardState>>;
  externalActive?: boolean;
  onExternalClose?: () => void;
}

const VOICE_UI: Record<string, any> = {
  [Language.ENGLISH]: { title: "Voice Advisor", help: "Ask about regions or metrics", listening: "Listening", standby: "Standby" },
  [Language.URDU]: { title: "وائس مشیر", help: "علاقوں یا میٹرکس کے بارے میں پوچھیں", listening: "سن رہا ہے", standby: "تیار ہے" },
  [Language.ARABIC]: { title: "مستشار صوتي", help: "اسأل عن المناطق أو المقاييس", listening: "جاري الاستماع", standby: "في الانتظار" },
  [Language.AUTO]: { title: "AI Advisor", help: "Talk in any language", listening: "Listening...", standby: "Standby" },
};

const CaptionOverlay = React.memo(({ speech, thought, isRtl, isMuted }: { speech: string, thought: string, isRtl: boolean, isMuted: boolean }) => {
  if (!speech && !thought && !isMuted) return null;
  return (
    <div className="fixed bottom-24 md:bottom-32 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none">
      <div className="bg-slate-900/90 backdrop-blur-md text-white p-4 md:p-6 rounded-2xl shadow-2xl border border-white/20 text-center animate-in fade-in slide-in-from-bottom-6">
         {isMuted && !speech && !thought ? (
           <div className="flex items-center justify-center gap-2 text-rose-300 font-semibold text-sm">
             <MicOff className="w-4 h-4 animate-pulse text-rose-400" />
             <span>Microphone Muted (Click floating mic button to unmute)</span>
           </div>
         ) : (
           <>
             <p className={`text-lg md:text-xl font-medium ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
               {speech || thought}
             </p>
             <div className="mt-2 text-[10px] uppercase font-black text-indigo-400 tracking-widest flex items-center justify-center gap-2">
               {isMuted && <span className="text-rose-400 font-bold">[MIC MUTED]</span>}
               <span>{speech ? 'Detecting Voice...' : 'Advisor Speaking'}</span>
             </div>
           </>
         )}
      </div>
    </div>
  );
});

const TranscriptList = React.memo(({ transcript, helpText, currentUserSpeech, currentThought, errorMessage, onRetry, onDismiss }: { 
  transcript: { text: string, type: 'user' | 'model' }[], 
  helpText: string,
  currentUserSpeech: string,
  currentThought: string,
  errorMessage: string | null,
  onRetry: () => void,
  onDismiss: () => void
}) => {
  return (
    <div className="flex-1 min-h-[300px] max-h-[450px] p-4 overflow-y-auto space-y-4 bg-slate-50 dark:bg-slate-900 relative">
      {errorMessage && (
        <div className="absolute inset-0 z-10 bg-rose-50/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-3">
             <MicOff className="w-6 h-6" />
          </div>
          <p className="text-rose-800 font-bold text-sm mb-1">Voice Session Notice</p>
          <p className="text-rose-700 text-xs mb-5 leading-relaxed max-w-[240px]">{errorMessage}</p>
          <div className="flex items-center gap-2">
            <button 
              onClick={onRetry}
              className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              Try Again
            </button>
            <button 
              onClick={onDismiss}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      {transcript.length === 0 && !currentUserSpeech && !currentThought && !errorMessage && (
        <div className="text-center py-12">
          <MessageCircle className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
          <p className="text-xs text-slate-400">{helpText}</p>
        </div>
      )}
      {transcript.map((item, i) => (
        <div key={i} className={`flex ${item.type === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] p-3 rounded-2xl text-xs shadow-sm border ${item.type === 'user' ? 'bg-indigo-600 text-white border-indigo-500 rounded-tr-none' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 border-slate-100 dark:border-slate-700 rounded-tl-none'}`}>
            {item.text}
          </div>
        </div>
      ))}
      {(currentUserSpeech || currentThought) && (
        <div className={`flex ${currentUserSpeech ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-[85%] p-3 rounded-2xl text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 italic animate-pulse">
            {currentUserSpeech || currentThought}
          </div>
        </div>
      )}
    </div>
  );
});

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
  language, 
  dataContext, 
  onUpdateDashboard,
  externalActive,
  onExternalClose
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [transcript, setTranscript] = useState<{ text: string, type: 'user' | 'model' }[]>([]);
  const [currentThought, setCurrentThought] = useState("");
  const [currentUserSpeech, setCurrentUserSpeech] = useState("");
  
  // Refs for persistent audio and stream management
  const isMutedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContext = useRef<AudioContext | null>(null);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTime = useRef(0);
  const sessionPromise = useRef<Promise<any> | null>(null);
  const workletNode = useRef<AudioWorkletNode | null>(null);

  // Stable references to props to prevent re-renders from breaking session callbacks
  const dataContextRef = useRef(dataContext);
  dataContextRef.current = dataContext;
  const languageRef = useRef(language);
  languageRef.current = language;
  const onUpdateDashboardRef = useRef(onUpdateDashboard);
  onUpdateDashboardRef.current = onUpdateDashboard;
  const onExternalCloseRef = useRef(onExternalClose);
  onExternalCloseRef.current = onExternalClose;

  const t = VOICE_UI[language] || VOICE_UI[Language.AUTO];
  const isRtl = language === Language.ARABIC || language === Language.URDU;

  // Optimized base64 decode
  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  // Optimized base64 encode for performance
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    const chunk = 8192;
    for (let i = 0; i < len; i += chunk) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  // Cleanly toggle microphone mute without dropping or reconnecting WebRTC/session
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  const stopSession = useCallback(async () => {
    if (isClosing) return;
    setIsClosing(true);
    
    const currentSessionPromise = sessionPromise.current;
    sessionPromise.current = null;

    setIsActive(false);
    setIsMuted(false);
    isMutedRef.current = false;
    setIsConnecting(false);
    
    if (onExternalCloseRef.current) {
      onExternalCloseRef.current();
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      mediaStreamRef.current = null;
    }

    if (workletNode.current) {
      try {
        workletNode.current.disconnect();
      } catch (e) {}
      workletNode.current = null;
    }

    if (inputAudioContext.current) {
      try { await inputAudioContext.current.close(); } catch (e) {}
      inputAudioContext.current = null;
    }
    if (outputAudioContext.current) {
      try { await outputAudioContext.current.close(); } catch (e) {}
      outputAudioContext.current = null;
    }
    
    sources.current.forEach(s => { try { s.stop(); } catch (e) {} });
    sources.current.clear();
    
    if (currentSessionPromise) {
      try {
        const session = await currentSessionPromise;
        if (session) {
          try {
            session.sendRealtimeInput({ audioStreamEnd: true });
          } catch (e) {}
          if (typeof session.close === 'function') {
            session.close();
          }
        }
      } catch (e) {
        console.error("Error closing session:", e);
      }
    }

    setCurrentThought("");
    setCurrentUserSpeech("");
    setIsClosing(false);
  }, [isClosing]);

  const startSession = async () => {
    if (isActive || isConnecting || isClosing) return;
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMessage("Secure connection (HTTPS) or browser support required for microphone.");
        setIsConnecting(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;
      setIsMuted(false);
      isMutedRef.current = false;
      
      // Ensure previous contexts are cleaned up
      if (inputAudioContext.current) {
        try { await inputAudioContext.current.close(); } catch (e) {}
      }
      if (outputAudioContext.current) {
        try { await outputAudioContext.current.close(); } catch (e) {}
      }

      inputAudioContext.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContext.current = new AudioContext({ sampleRate: 24000 });
      
      // Load AudioWorklet for low-latency capture
      const workletCode = `
        class RecorderProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.bufferSize = 2048;
            this.buffer = new Float32Array(this.bufferSize);
            this.bufferIndex = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input[0]) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = channelData[i];
                if (this.bufferIndex >= this.bufferSize) {
                  this.port.postMessage(new Float32Array(this.buffer));
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('recorder-processor', RecorderProcessor);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await inputAudioContext.current.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const outputNode = outputAudioContext.current.createGain();
      outputNode.connect(outputAudioContext.current.destination);

      const sessionCall = getVoiceSession(languageRef.current, dataContextRef.current, {
        onopen: async () => {
          console.log("Voice session opened");
          setIsActive(true);
          setIsConnecting(false);
          
          if (!inputAudioContext.current) return;
          if (inputAudioContext.current.state === 'suspended') {
            await inputAudioContext.current.resume();
          }

          const source = inputAudioContext.current.createMediaStreamSource(stream);
          workletNode.current = new AudioWorkletNode(inputAudioContext.current, 'recorder-processor');
          
          workletNode.current.port.onmessage = (e) => {
            // When muted, drop audio capture cleanly without disconnecting
            if (isMutedRef.current) return;

            const inputData = e.data; // Float32Array
            
            // Efficient PCM conversion
            const l = inputData.length;
            const int16 = new Int16Array(l);
            for (let i = 0; i < l; i++) {
              int16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
            }
            
            const pcmBlob: GenAIBlob = { 
              data: encode(new Uint8Array(int16.buffer)), 
              mimeType: 'audio/pcm;rate=16000' 
            };
            
            sessionCall.then((session) => {
              if (sessionPromise.current === sessionCall && !isMutedRef.current) {
                try {
                  session.sendRealtimeInput({ audio: pcmBlob });
                } catch (err) {
                  console.error("Failed to send audio data", err);
                }
              }
            }).catch(() => {});
          };

          source.connect(workletNode.current);
          workletNode.current.connect(inputAudioContext.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (sessionPromise.current !== sessionCall) return;
          if (message.toolCall?.functionCalls) {
            for (const fc of message.toolCall.functionCalls) {
              if (fc.name === 'update_dashboard_filters') {
                const args = fc.args as any;
                if (args.column && args.value) {
                  onUpdateDashboardRef.current(prev => ({
                    ...prev,
                    filter: { ...prev.filter, [args.column]: args.value }
                  }));
                } else {
                  onUpdateDashboardRef.current(prev => ({ 
                    ...prev, 
                    filter: { ...prev.filter, ...args } 
                  }));
                }
              } else if (fc.name === 'highlight_metric') {
                onUpdateDashboardRef.current(prev => ({ ...prev, highlightedMetric: fc.args.metric as any }));
                setTimeout(() => onUpdateDashboardRef.current(prev => ({ ...prev, highlightedMetric: undefined })), 5000);
              } else if (fc.name === 'reset_dashboard') {
                onUpdateDashboardRef.current({ filter: {}, highlightedMetric: undefined, activeTab: 'home', drillDown: undefined, comparison: undefined });
              } else if (fc.name === 'navigate_to_tab') {
                const raw = (fc.args as any)?.target_tab || (fc.args as any)?.tab;
                const resolved = normalizeTabId(raw);
                if (resolved) {
                  onUpdateDashboardRef.current(prev => ({ ...prev, activeTab: resolved }));
                }
              } else if (fc.name === 'interact_pdf_document') {
                const args = fc.args as any;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'pdfInsights',
                  pdfVoiceAction: {
                    type: args.action === 'open_pdf_mode' ? 'route' : args.action,
                    documentIndex: args.documentIndex,
                    outputTab: args.outputTab,
                    pageNumber: args.pageNumber,
                    contentToRead: args.contentToRead,
                    timestamp: Date.now()
                  }
                }));
              } else if (fc.name === 'sort_data') {
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  sortBy: fc.args.sortBy,
                  sortDirection: (fc.args.sortDirection as any) || 'desc'
                }));
              } else if (fc.name === 'drill_down') {
                const targetType = fc.args.type;
                const targetVal = fc.args.value;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  drillDown: { type: targetType, value: targetVal },
                  filter: { ...prev.filter, [targetType]: targetVal }
                }));
              } else if (fc.name === 'switch_chart_type') {
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  chartType: fc.args.chartType as any,
                  customChart: {
                    ...prev.customChart,
                    chartType: fc.args.chartType as any
                  }
                }));
              } else if (fc.name === 'update_custom_chart') {
                const args = fc.args as any;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'dashboard',
                  customChart: {
                    dimension: args.dimension || prev.customChart?.dimension,
                    measure: args.measure || prev.customChart?.measure,
                    chartType: (args.chartType as any) || prev.customChart?.chartType || 'bar',
                    lastCommand: currentUserSpeech || 'Voice Command',
                    explanation: args.explanation
                  }
                }));
                setTimeout(() => {
                  const chartEl = document.getElementById('custom-chart-builder');
                  if (chartEl) chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              } else if (fc.name === 'set_date_range') {
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  dateRange: { start: fc.args.start, end: fc.args.end }
                }));
              } else if (fc.name === 'show_comparison') {
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  comparison: { type: fc.args.type, values: [fc.args.valueA, fc.args.valueB] }
                }));
              } else if (fc.name === 'generate_action_plan') {
                const args = fc.args as any;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'dashboard',
                  activeActionPlan: {
                    id: `plan-${Date.now()}`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    triggeredBy: currentUserSpeech || 'Live Voice Instruction',
                    conclusion: args.conclusion || 'Analysis completed.',
                    rootCause: args.rootCause,
                    riskLevel: (args.riskLevel as any) || 'Medium',
                    recommendations: Array.isArray(args.recommendations) ? args.recommendations : [args.recommendations],
                    actionItems: (args.actionItems || []).map((item: any, idx: number) => ({
                      id: `act-${idx}`,
                      task: item.task,
                      owner: item.owner || 'Commercial Lead',
                      priority: item.priority || 'High',
                      expectedRoi: item.expectedRoi || 'Target Growth',
                      deadline: item.deadline || '14 Days',
                      completed: false
                    }))
                  }
                }));
              } else if (fc.name === 'click_element') {
                const args = fc.args as any;
                executeVoiceClick({
                  textMatch: args.text_match || '',
                  selector: args.selector,
                  target: args.target || 'any',
                  actionType: args.action_type || 'click'
                });
              } else if (fc.name === 'input_text') {
                const args = fc.args as any;
                executeVoiceInput({
                  selectorOrPlaceholder: args.selector_or_placeholder || '',
                  text: args.text || '',
                  target: args.target || 'any',
                  submit: args.submit ?? true
                });
              } else if (fc.name === 'scroll_page') {
                const args = fc.args as any;
                executeVoiceScroll(args.direction || 'down', args.target || 'any');
              } else if (fc.name === 'filter_units') {
                const args = fc.args as any;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'dashboard',
                  filter: {
                    ...prev.filter,
                    ...(args.bedrooms !== undefined ? { bedrooms: String(args.bedrooms) } : {}),
                    ...(args.propertyType ? { propertyType: args.propertyType } : {}),
                    ...(args.status ? { status: args.status } : {}),
                    ...(args.paymentPlan ? { paymentPlan: args.paymentPlan } : {})
                  }
                }));
              } else if (fc.name === 'synthesize_b2c_faqs') {
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'dashboard'
                }));
              } else if (fc.name === 'select_unit') {
                const args = fc.args as any;
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  activeTab: 'dashboard',
                  filter: {
                    ...prev.filter,
                    unitCode: args.unitCode
                  }
                }));
              } else if (fc.name === 'capture_whatsapp_lead') {
                const args = fc.args as any;
                const rawPhone = String(args.phone_number || '');
                const cleanDigits = rawPhone.replace(/\D/g, '');
                let formattedNumber = cleanDigits;
                if (cleanDigits.startsWith('92') && cleanDigits.length === 12) {
                  formattedNumber = '0' + cleanDigits.substring(2);
                } else if (!cleanDigits.startsWith('0') && cleanDigits.length === 10) {
                  formattedNumber = '0' + cleanDigits;
                }
                const leadName = args.user_name || '';
                onUpdateDashboardRef.current(prev => ({
                  ...prev,
                  whatsAppLead: {
                    phoneNumber: formattedNumber,
                    userName: leadName,
                    timestamp: Date.now(),
                    dispatched: false
                  }
                }));
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('gemini-whatsapp-lead', {
                    detail: {
                      phoneNumber: formattedNumber,
                      userName: leadName,
                      autoDispatch: true
                    }
                  }));
                }
              }
              sessionCall.then(s => {
                if (sessionPromise.current === sessionCall) {
                  let toolResultMsg = "Action executed successfully";
                  if (fc.name === 'navigate_to_tab') {
                    const raw = (fc.args as any)?.target_tab || (fc.args as any)?.tab;
                    const resolved = normalizeTabId(raw);
                    toolResultMsg = resolved 
                      ? `Navigated to ${TAB_DIRECTORY[resolved]?.label || resolved}. ${TAB_DIRECTORY[resolved]?.confirmation || ''}`
                      : `Switched tab to ${raw}`;
                  } else if (fc.name === 'click_element') {
                    toolResultMsg = `Triggered click on "${(fc.args as any)?.text_match}"`;
                  } else if (fc.name === 'input_text') {
                    toolResultMsg = `Entered text "${(fc.args as any)?.text}"`;
                  } else if (fc.name === 'scroll_page') {
                    toolResultMsg = `Scrolled ${(fc.args as any)?.direction}`;
                  } else if (fc.name === 'filter_units') {
                    toolResultMsg = `Applied unit inventory filters`;
                  } else if (fc.name === 'synthesize_b2c_faqs') {
                    toolResultMsg = `Generated and displayed consumer-facing B2C FAQs`;
                  } else if (fc.name === 'select_unit') {
                    toolResultMsg = `Selected unit ${(fc.args as any)?.unitCode}`;
                  } else if (fc.name === 'capture_whatsapp_lead') {
                    const args = fc.args as any;
                    toolResultMsg = `Captured lead: Phone ${(fc.args as any)?.phone_number}, Name ${(fc.args as any)?.user_name || 'Customer'}. Auto-brochure compilation triggered.`;
                  }
                  s.sendToolResponse({
                    functionResponses: [{ id: fc.id, name: fc.name, response: { result: toolResultMsg } }]
                  });
                }
              }).catch(() => {});
            }
          }

          // 2. Transcriptions
          if (message.serverContent?.outputTranscription) {
            setCurrentThought(prev => prev + message.serverContent!.outputTranscription!.text);
          } else if (message.serverContent?.inputTranscription) {
            setCurrentUserSpeech(prev => prev + message.serverContent!.inputTranscription!.text);
          }
          
          if (message.serverContent?.turnComplete) {
            setTranscript(prev => {
              const newItems = [];
              if (currentUserSpeech) newItems.push({ text: currentUserSpeech, type: 'user' as const });
              if (currentThought) newItems.push({ text: currentThought, type: 'model' as const });
              return [...prev.slice(-10), ...newItems];
            });
            setCurrentUserSpeech("");
            setCurrentThought("");
          }

          // 3. Audio Output
          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio && outputAudioContext.current) {
            if (outputAudioContext.current.state === 'suspended') await outputAudioContext.current.resume();
            
            const buffer = await decodeAudioData(decode(base64Audio), outputAudioContext.current, 24000, 1);
            const source = outputAudioContext.current.createBufferSource();
            source.buffer = buffer;
            source.connect(outputNode);
            
            // Precise scheduling to avoid gaps
            const now = outputAudioContext.current.currentTime;
            if (nextStartTime.current < now) {
              nextStartTime.current = now + 0.05; // Small buffer for first chunk
            }
            
            source.start(nextStartTime.current);
            nextStartTime.current += buffer.duration;
            sources.current.add(source);
            source.onended = () => sources.current.delete(source);
          }

          // 4. Interruption
          if (message.serverContent?.interrupted) {
            sources.current.forEach(s => { try { s.stop(); } catch (e) {} });
            sources.current.clear();
            nextStartTime.current = 0;
            setCurrentThought("");
            setCurrentUserSpeech("");
          }
        },
        onerror: (err: any) => {
          const rawReason = (err && (err.message || err.reason)) || "";
          const isUnavailable = typeof rawReason === 'string' && (rawReason.includes("unavailable") || rawReason.includes("503") || rawReason.includes("capacity"));
          
          if (isUnavailable) {
            console.warn("Voice session service temporarily unavailable:", rawReason);
            setErrorMessage("The Gemini Live voice service is temporarily experiencing high traffic. Tap 'Try Again' in a moment to reconnect.");
          } else {
            console.warn("Voice session connection issue:", rawReason || err);
            setErrorMessage(rawReason || "Voice connection failed. Please verify your Gemini API key in Settings.");
          }
          setIsMinimized(false);
          stopSession();
        },
        onclose: (event: any) => {
          console.log("Voice session closed:", event);
          if (event && event.code && event.code !== 1000) {
            let reason = event.reason || `Session closed (code ${event.code})`;
            if (event.code === 1008 || (event.reason && (event.reason.includes("leaked") || event.reason.includes("API key")))) {
              reason = "API key was reported as leaked or rejected. Please update your GEMINI_API_KEY in the Settings menu.";
            } else if (event.code === 1006 || reason.includes("unavailable") || reason.includes("abnormal")) {
              reason = "Voice connection interrupted or service temporarily unavailable. Tap 'Try Again' to reconnect.";
            }
            setErrorMessage(reason);
            setIsMinimized(false);
          }
          stopSession();
        },
      });
      sessionPromise.current = sessionCall;
    } catch (err: any) {
      console.warn("Voice initiation issue", err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMessage("Microphone not found. Please connect a mic and try again.");
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage("Microphone access denied. Please enable permissions in settings.");
      } else {
        const msg = err.message || "Unknown error";
        if (typeof msg === 'string' && (msg.includes("unavailable") || msg.includes("503"))) {
          setErrorMessage("The Gemini Live voice service is temporarily busy. Tap 'Try Again' in a moment to reconnect.");
        } else {
          setErrorMessage("Voice service notice: " + msg);
        }
      }
      setIsMinimized(false);
      stopSession();
    }
  };

  // Sync with external activation ONLY when externalActive transitions to true
  const prevExternalActiveRef = useRef(externalActive);
  useEffect(() => {
    if (externalActive && !prevExternalActiveRef.current && !isActive && !isConnecting) {
      setIsMinimized(false);
      startSession();
    }
    prevExternalActiveRef.current = externalActive;
  }, [externalActive, isActive, isConnecting]);

  // Clean up ONLY on full component unmount (never on state updates)
  useEffect(() => {
    return () => {
      const currentSessionPromise = sessionPromise.current;
      sessionPromise.current = null;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => {
          try { track.stop(); } catch (e) {}
        });
        mediaStreamRef.current = null;
      }
      if (workletNode.current) {
        try { workletNode.current.disconnect(); } catch (e) {}
        workletNode.current = null;
      }
      if (inputAudioContext.current) {
        try { inputAudioContext.current.close(); } catch (e) {}
        inputAudioContext.current = null;
      }
      if (outputAudioContext.current) {
        try { outputAudioContext.current.close(); } catch (e) {}
        outputAudioContext.current = null;
      }
      if (currentSessionPromise) {
        currentSessionPromise.then(s => {
          try { s.sendRealtimeInput({ audioStreamEnd: true }); } catch (e) {}
          if (typeof s.close === 'function') s.close();
        }).catch(() => {});
      }
    };
  }, []);

  // Floating button cleanly toggles mute when session is active, or starts session if off
  const handleFloatingButtonClick = () => {
    if (!isActive) {
      if (!isConnecting && !isClosing) {
        setIsMinimized(false);
        startSession();
      }
    } else {
      // Session is already running: clean 1-click mute toggle without reconnecting
      toggleMute();
    }
  };

  return (
    <>
      {isActive && <CaptionOverlay speech={currentUserSpeech} thought={currentThought} isRtl={isRtl} isMuted={isMuted} />}

      {/* Floating Control Cluster */}
      <div className={`fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 md:left-auto ${isRtl ? 'md:left-8' : 'md:right-8'} md:translate-x-0 z-40 flex items-center gap-3`}>
        {isActive && (
          <button
            onClick={stopSession}
            className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xl transition-all hover:scale-105 active:scale-95 border border-rose-400/30"
            title="End voice session"
          >
            <PhoneOff className="w-4 h-4" />
            <span className="hidden sm:inline">End Session</span>
          </button>
        )}

        <button 
          onClick={handleFloatingButtonClick} 
          disabled={isConnecting && !isActive}
          title={
            !isActive 
              ? "Start Voice Advisor" 
              : isMuted 
                ? "Microphone Muted • Click to Unmute" 
                : "Microphone Live • Click to Mute"
          }
          className={`relative w-16 h-16 md:w-20 md:h-20 rounded-full shadow-2xl flex items-center justify-center transition-all cursor-pointer ${
            !isActive 
              ? isConnecting 
                ? 'bg-amber-500 shadow-amber-200 cursor-wait' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300 hover:scale-105 active:scale-95'
              : isMuted 
                ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200 ring-4 ring-rose-300/60 hover:scale-105 active:scale-95' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200 ring-4 ring-emerald-300/60 hover:scale-105 active:scale-95'
          }`}
        >
          {isConnecting ? (
            <Loader2 className="w-8 h-8 md:w-10 md:h-10 text-white animate-spin" />
          ) : !isActive ? (
            <Mic className="w-8 h-8 md:w-10 md:h-10 text-white" />
          ) : isMuted ? (
            <div className="flex flex-col items-center">
              <MicOff className="w-7 h-7 md:w-9 md:h-9 text-white" />
              <span className="text-[9px] font-black text-white uppercase tracking-tighter mt-0.5">Muted</span>
            </div>
          ) : (
            <>
              <span className="absolute -inset-1 rounded-full bg-emerald-400 opacity-30 animate-ping pointer-events-none" />
              <div className="flex flex-col items-center relative z-10">
                <Mic className="w-7 h-7 md:w-9 md:h-9 text-white" />
                <span className="text-[9px] font-black text-white uppercase tracking-tighter mt-0.5">Live</span>
              </div>
            </>
          )}
        </button>
      </div>

      {!isMinimized && (
        <div className={`fixed bottom-24 md:bottom-32 left-0 right-0 md:left-auto md:right-8 mx-4 md:mx-0 md:w-84 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-40 flex flex-col ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between shrink-0">
            <div className={`flex items-center gap-2.5 ${isRtl ? 'flex-row-reverse' : ''}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${
                isActive 
                  ? isMuted ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse' 
                  : isConnecting ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'
              }`} />
              <div>
                <span className="font-bold text-sm block leading-tight">
                  {isActive ? (isMuted ? `${t.title} (Muted)` : `${t.title} (Listening)`) : isConnecting ? 'Connecting...' : t.title}
                </span>
                {isActive && (
                  <span className="text-[10px] text-indigo-200 block">
                    {isMuted ? 'Mic paused • Click mic button to speak' : 'Active conversation • Click mic to mute'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {isActive && (
                <button 
                  onClick={stopSession}
                  className="px-2 py-1 bg-rose-500/90 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                  title="End Session"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span className="text-[11px]">End</span>
                </button>
              )}
              <button 
                onClick={() => setIsMinimized(true)} 
                className="p-1.5 hover:bg-indigo-500 rounded-lg text-white/90 hover:text-white transition-colors"
                title="Minimize window"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          <TranscriptList 
            transcript={transcript} 
            helpText={t.help} 
            currentUserSpeech={currentUserSpeech} 
            currentThought={currentThought} 
            errorMessage={errorMessage}
            onRetry={() => {
              setErrorMessage(null);
              startSession();
            }}
            onDismiss={() => {
              setErrorMessage(null);
            }}
          />
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
