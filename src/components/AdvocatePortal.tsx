import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Mic, Camera, FileText, Users, Bell, HelpCircle, 
  BookOpen, Edit3, Layout, MessageSquare, Settings, 
  Download, Globe, Wifi, WifiOff, Shield, Save, Trash2,
  ChevronLeft, ChevronRight, Play, Square, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Info, X, Search, Plus, RotateCcw,
  Volume2, Send, Trash, Check, AlertCircle, RefreshCw, Zap, Brain,
  Maximize2, Minimize2, FileUp, Languages, Upload, Archive
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
import confetti from 'canvas-confetti';
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { HybridAIEngine, AIMessage } from "../lib/ai-engine";
import { LocalDB } from "../lib/local-db";
import { GoogleDriveService } from "../lib/google-drive-service";
import axios from "axios";

// --- Custom Icon Component from Snippet ---
const Icon = ({ path, size = 20, strokeWidth = 2, style }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {Array.isArray(path) ? path.map((d: string, i: number) => <path key={i} d={d} />) : <path d={path} />}
  </svg>
);

// --- Constants ---
const SIMULATED_CALLS = [
  {
    id: 1,
    clientName: "Sreedharan K.",
    phone: "+91 9876543210",
    timestamp: "2026-03-24 10:30 AM",
    duration: "4m 12s",
    transcript: [
      { role: "client", text: "Hello Advocate, I am calling about the property dispute in Aluva. My neighbor Rajan has started building a fence that encroaches about 2 cents into my land." },
      { role: "advocate", text: "I see. Do you have the title deeds and the survey map ready?" },
      { role: "client", text: "Yes, I have them. He claims it's his land based on some old document, but my registered sale deed from 1994 clearly shows the boundaries." },
      { role: "advocate", text: "We might need to file for an interim injunction. I will check the legal sections and get back to you." }
    ],
    summary: "Property encroachment dispute in Aluva. Neighbor Rajan building illegal fence. Client has 1994 sale deed."
  },
  {
    id: 2,
    clientName: "Elena Rodriguez",
    phone: "+1 555-0199",
    timestamp: "2026-03-23 02:15 PM",
    duration: "2m 45s",
    transcript: [
      { role: "client", text: "Advocate, I received a notice from the cooperative society regarding my membership. They are saying I haven't paid the maintenance for 6 months, but I have the receipts." },
      { role: "advocate", text: "Please send me the receipts and the notice. We can reply to them under the Cooperative Societies Act." }
    ],
    summary: "Cooperative society membership notice. Maintenance payment dispute. Client has receipts."
  },
  {
    id: 3,
    clientName: "Raju Varma",
    phone: "+91 9447001122",
    timestamp: "2026-03-22 11:00 AM",
    duration: "1m 30s",
    transcript: [
      { role: "client", text: "Sir, I am calling about the bail application for my brother. Is it listed for tomorrow?" },
      { role: "advocate", text: "Yes, it is listed in Court Room 4. Please be there by 10:30 AM." }
    ],
    summary: "Bail application status inquiry. Listed for tomorrow in Court Room 4."
  },
  {
    id: 4,
    clientName: "Anjali Menon",
    phone: "+91 9895004433",
    timestamp: "2026-03-21 04:45 PM",
    duration: "5m 10s",
    transcript: [
      { role: "client", text: "Advocate, I want to discuss the divorce petition. My husband is not agreeing to the mutual consent terms we discussed." },
      { role: "advocate", text: "In that case, we might have to file a contested petition. Let's meet and discuss the grounds." }
    ],
    summary: "Divorce petition consultation. Mutual consent failed. Planning for contested petition."
  }
];

const LAW_CATEGORIES = [
  { id: 'railway', label: 'Railway Law', color: '#f59e0b' },
  { id: 'cooperative', label: 'Cooperative Law', color: '#10b981' },
  { id: 'property', label: 'Property Law', color: '#6366f1' },
  { id: 'criminal', label: 'Criminal Law', color: '#ef4444' },
  { id: 'labour', label: 'Labour Law', color: '#8b5cf6' },
];

const getCatRgb = (color: string) => {
  const map: any = { '#f59e0b': '245,158,11', '#10b981': '16,185,129', '#6366f1': '99,102,241', '#ef4444': '239,68,68', '#8b5cf6': '139,92,246' };
  return map[color] || '99,102,241';
};

export default function AdvocatePortal() {
  const [view, setView] = useState("command");
  const [aiStatus, setAiStatus] = useState<any>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [showTutorial, setShowTutorial] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDbReady, setIsDbReady] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [isKeyValidating, setIsKeyValidating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    // Auth check moved to init flow below
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const response = await axios.get('/api/auth/url');
      const authUrl = response.data.url;
      
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        authUrl,
        'google-auth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'OAUTH_AUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          setIsLoggedIn(true);
          setUser({
            displayName: 'Advocate',
            email: 'user@nexus.justice',
            photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=advocate'
          });
          speak("Google account connected successfully. Welcome to Nexus Justice.");
          setOnboardingStep(2);
          // Refresh AI engine
          await aiEngine.updateStatus(true);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error: any) {
      console.error("Login failed:", error);
      const rawError = error.response?.data?.error;
      let errorMsg = "Unknown error";
      
      if (typeof rawError === 'string') {
        errorMsg = rawError;
      } else if (rawError && typeof rawError === 'object') {
        errorMsg = rawError.message || JSON.stringify(rawError);
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      setLoginError(errorMsg);
      speak(`Connection failed: ${errorMsg}. Please try again.`);
    }
  };

  useEffect(() => {
    if (onboardingStep === 1 && !isLoggedIn) {
      speak("Welcome to Nexus Justice. Please connect your Google account to begin your secure legal orchestration.");
    } else if (onboardingStep === 2) {
      speak("Authentication success. Now, we need to connect to your brain. Please follow the instructions to create your Gemini API key. Click the Create API key button, copy the generated key, then return here and paste it into the field below. Finally, click Connect to Brain.");
    }
  }, [onboardingStep, isLoggedIn]);

  const handleConnectToBrain = async () => {
    if (!userApiKey.trim()) {
      speak("Please paste your API key first.");
      return;
    }
    setIsKeyValidating(true);
    try {
      // Set the key in the AI engine
      aiEngine.setApiKey(userApiKey.trim());
      
      // Store the key locally
      localDB.setConfig('gemini_api_key', userApiKey.trim());
      localStorage.setItem('nexus_gemini_api_key', userApiKey.trim());
      localStorage.setItem('onboarding_complete', 'true');
      
      // The user's specific success message
      speak("the key sucessfully copied now you can do your legal works");
      
      // Trigger confetti for success
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f43f5e']
      });

      // Automatically transition to the command center after a short delay
      setTimeout(() => {
        setShowOnboarding(false);
        setOnboardingStep(4);
        setView('command');
      }, 2500);
      
    } catch (error) {
      console.error("Key validation failed:", error);
      speak("Failed to connect to brain. Please check your API key.");
    } finally {
      setIsKeyValidating(false);
    }
  };

  // Auto-detect API key paste for a seamless experience
  useEffect(() => {
    if (onboardingStep === 2 && userApiKey.trim().length > 35 && userApiKey.startsWith('AIza')) {
      handleConnectToBrain();
    }
  }, [userApiKey, onboardingStep]);

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
      setUser(null);
      setIsLoggedIn(false);
      setCloudSync(false);
      setView('command');
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const syncToCloud = async () => {
    if (!isLoggedIn || !cloudSync) return;
    
    const driveService = GoogleDriveService.getInstance();
    
    try {
      // Get Access Token from backend for Drive
      const tokenRes = await axios.get('/api/ai/token');
      driveService.setAccessToken(tokenRes.data.accessToken);

      // Get SQLite binary
      const savedData = localStorage.getItem('nexus_sqlite_db');
      if (!savedData) return;
      
      const u8 = new Uint8Array(JSON.parse(savedData));
      await driveService.uploadFile(u8);

      speak("Legal database backed up to your Google Drive.");
    } catch (error) {
      console.error("Cloud sync failed:", error);
      speak("Google Drive sync failed. Please check your connection.");
    }
  };

  const restoreFromCloud = async () => {
    if (!isLoggedIn) {
      speak("Please connect your Google account first.");
      return;
    }
    
    const driveService = GoogleDriveService.getInstance();
    try {
      const tokenRes = await axios.get('/api/ai/token');
      driveService.setAccessToken(tokenRes.data.accessToken);

      const binary = await driveService.downloadFile();
      if (binary) {
        localStorage.setItem('nexus_sqlite_db', JSON.stringify(Array.from(binary)));
        speak("Legal database restored from Google Drive. Please refresh to apply changes.");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        speak("No backup found in your Google Drive.");
      }
    } catch (error) {
      console.error("Restore failed:", error);
      speak("Failed to restore from Google Drive.");
    }
  };

  useEffect(() => {
    if (cloudSync && user) {
      syncToCloud();
    }
  }, [cloudSync, user]);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };


  const [isLiveMode, setIsLiveMode] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextLiveRef = useRef<AudioContext | null>(null);
  const audioInputWorkletRef = useRef<any>(null);
  const audioOutputWorkletRef = useRef<any>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<any>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingLiveRef = useRef(false);

  useEffect(() => {
    if (user && autoStartLive) {
      setNotifications(prev => [
        { id: Date.now(), message: "Always-On Voice Mode Active. Click anywhere to initialize the live mic.", date: new Date().toISOString().split('T')[0], read: false, type: 'system' },
        ...prev
      ]);
    }
  }, [user]);

  const [autoStartLive, setAutoStartLive] = useState(true);

  useEffect(() => {
    if (user && autoStartLive && !isLiveMode && !liveSessionRef.current) {
      const handleFirstInteraction = () => {
        if (autoStartLive && !isLiveMode && !liveSessionRef.current) {
          startLiveSession();
        }
        // Prime speech synthesis
        if ('speechSynthesis' in window) {
          const v = new SpeechSynthesisUtterance("");
          v.volume = 0;
          window.speechSynthesis.speak(v);
        }
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
      };
      
      window.addEventListener('click', handleFirstInteraction);
      window.addEventListener('keydown', handleFirstInteraction);
      window.addEventListener('touchstart', handleFirstInteraction);
      
      return () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('keydown', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
      };
    }
  }, [user, autoStartLive, isLiveMode]);

  const startLiveSession = async () => {
    try {
      setIsLiveMode(true);
      setVoiceAiStatus("Connecting Live...");

      const session = await aiEngine.connectLive({
        onopen: () => {
          console.log("Live session opened");
          setVoiceAiStatus("Live Active");
          startAudioCapture(session);
          startVideoCapture(session);
        },
        onmessage: (message) => {
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                const base64Data = part.inlineData.data;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const pcmData = new Int16Array(bytes.buffer);
                audioQueueRef.current.push(pcmData);
                if (!isPlayingLiveRef.current) {
                  playNextAudioChunk();
                }
              }
            }
          }
          if (message.serverContent?.interrupted) {
            audioQueueRef.current = [];
            isPlayingLiveRef.current = false;
          }
        },
        onerror: (err) => {
          console.error("Live session error:", err);
          stopLiveSession();
          // If it was an error, we might want to try again after a delay if autoStart is still true
          if (autoStartLive) {
            setTimeout(() => {
              if (autoStartLive && !isLiveMode) startLiveSession();
            }, 3000);
          }
        },
        onclose: () => {
          console.log("Live session closed");
          if (autoStartLive) {
            // Reconnect if it closed but we still want it on
            setTimeout(() => {
              if (autoStartLive && !isLiveMode) startLiveSession();
            }, 1000);
          } else {
            stopLiveSession();
          }
        }
      });

      liveSessionRef.current = session;
    } catch (err) {
      console.error("Failed to start live session:", err);
      stopLiveSession();
    }
  };

  const stopLiveSession = () => {
    setAutoStartLive(false); // Disable auto-start if user manually stops
    setIsLiveMode(false);
    setVoiceAiStatus("");
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    stopAudioCapture();
    stopVideoCapture();
    audioQueueRef.current = [];
    isPlayingLiveRef.current = false;
  };

  const startAudioCapture = async (session: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext({ sampleRate: 16000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      audioContextLiveRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
      audioInputWorkletRef.current = { stream, processor, source };
    } catch (err) {
      console.error("Audio capture failed:", err);
    }
  };

  const stopAudioCapture = () => {
    if (audioInputWorkletRef.current) {
      audioInputWorkletRef.current.stream.getTracks().forEach((t: any) => t.stop());
      audioInputWorkletRef.current.processor.disconnect();
      audioInputWorkletRef.current.source.disconnect();
      audioInputWorkletRef.current = null;
    }
    if (audioContextLiveRef.current) {
      audioContextLiveRef.current.close();
      audioContextLiveRef.current = null;
    }
  };

  const startVideoCapture = async (session: any) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = stream;
      }

      frameIntervalRef.current = setInterval(() => {
        if (liveVideoRef.current && liveCanvasRef.current) {
          const context = liveCanvasRef.current.getContext('2d');
          if (context) {
            liveCanvasRef.current.width = 320;
            liveCanvasRef.current.height = 240;
            context.drawImage(liveVideoRef.current, 0, 0, 320, 240);
            const base64Data = liveCanvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
            session.sendRealtimeInput({
              video: { data: base64Data, mimeType: 'image/jpeg' }
            });
          }
        }
      }, 1000); // Send frame every second
    } catch (err) {
      console.error("Video capture failed:", err);
    }
  };

  const stopVideoCapture = () => {
    if (liveVideoRef.current && liveVideoRef.current.srcObject) {
      const stream = liveVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(t => t.stop());
      liveVideoRef.current.srcObject = null;
    }
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  const playNextAudioChunk = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingLiveRef.current = false;
      return;
    }

    isPlayingLiveRef.current = true;
    const pcmData = audioQueueRef.current.shift()!;
    const audioContext = audioContextLiveRef.current;
    if (!audioContext) return;
    
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 0x7FFF;
    }

    const buffer = audioContext.createBuffer(1, floatData.length, 16000);
    buffer.getChannelData(0).set(floatData);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      playNextAudioChunk();
    };
    source.start();
  };

  const [aiSuggestionsList, setAiSuggestionsList] = useState<{ text: string, selected: boolean }[]>([]);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [relatedCasesList, setRelatedCasesList] = useState<{ citation: string, description: string, selected: boolean, placement: string, reason: string }[]>([]);
  const [showCasesDropdown, setShowCasesDropdown] = useState(false);
  const [writingDeskPhase, setWritingDeskPhase] = useState<'facts' | 'suggestions' | 'cases' | 'final'>('facts');

  // AI Engine & DB
  const aiEngine = HybridAIEngine.getInstance();
  const localDB = LocalDB.getInstance();
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- State from Snippet ---
  const [clients, setClients] = useState<any[]>([]);
  const [addingClient, setAddingClient] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [viewingDocsClient, setViewingDocsClient] = useState<any | null>(null);
  const [newClient, setNewClient] = useState({ name: '', phone: '', case_number: '', court: '', next_date: '', purpose: '', opp_advocate_name: '', opp_advocate_phone: '', documents: [] as any[] });
  const [chatHistory, setChatHistory] = useState<AIMessage[]>([]);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, message: "Welcome to Nexus Justice v3.1. Your AI Orchestrator is ready.", date: "2026-03-24", read: false, type: 'general' },
  ]);
  const [supportMsgs, setSupportMsgs] = useState([{ id: 1, role: 'ai', text: 'Hello. I am the Nexus Support AI. Please describe any issues you are facing with the platform.' }]);
  const [supportInput, setSupportInput] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);

  const sendSupportMessage = async () => {
    if (!supportInput.trim() || supportLoading) return;
    const text = supportInput.trim();
    setSupportInput("");
    setSupportLoading(true);

    const userMsg = { id: Date.now(), role: 'user', text };
    setSupportMsgs(prev => [...prev, userMsg]);

    try {
      const history: AIMessage[] = [
        { role: 'system', content: 'You are the Nexus Justice Support AI. Help the user with platform issues, technical questions, or legal tool guidance. Keep it professional and helpful.' },
        ...supportMsgs.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.text } as AIMessage))
      ];

      const response = await aiEngine.generateResponse(text, history);

      setSupportMsgs(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: response.text }]);
      speakResponse(response.text);
    } catch (error) {
      console.error("Support AI failed:", error);
      setSupportMsgs(prev => [...prev, { id: Date.now() + 1, role: 'ai', text: "I'm having trouble connecting to the support server. Please try again later." }]);
    } finally {
      setSupportLoading(false);
    }
  };

  // Reading Room / OCR
  const [scanPhase, setScanPhase] = useState<'idle' | 'starting' | 'live' | 'processing' | 'done' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedText, setScannedText] = useState('');
  const [scanError, setScanError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Writing Desk
  const [draftPages, setDraftPages] = useState(["IN THE COURT OF THE DISTRICT JUDGE...\n\n[Drafting starts here]"]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [deskView, setDeskView] = useState('split');
  const [draftEditMode, setDraftEditMode] = useState(false);
  const [deskInput, setDeskInput] = useState('');
  const [deskLoading, setDeskLoading] = useState(false);
  const [deskChatHistory, setDeskChatHistory] = useState<any[]>([
    { role: 'ai', text: "Welcome to the Writing Desk. I can help you draft petitions and plaints. Provide facts of the case to get started." }
  ]);

  // Writing Desk Enhanced States
  const [writingPad, setWritingPad] = useState('');
  const [caseFacts, setCaseFacts] = useState('');
  const [draftingModel, setDraftingModel] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [isRecordingFacts, setIsRecordingFacts] = useState(false);
  const [maximizedColumn, setMaximizedColumn] = useState<'none' | 'inputs' | 'editor' | 'assistant'>('none');

  // --- Document Converter State ---
  const [converterInputText, setConverterInputText] = useState("");
  const [converterTranslatedText, setConverterTranslatedText] = useState("");
  const [converterTargetLang, setConverterTargetLang] = useState("ml-IN"); // Default to Malayalam
  const [isConverting, setIsConverting] = useState(false);
  const [converterPhase, setConverterPhase] = useState<'idle' | 'scanning' | 'translating'>('idle');

  // Voice AI Dock
  const [voiceAiOn, setVoiceAiOn] = useState(true);
  const [voiceAiListening, setVoiceAiListening] = useState(false);
  const [voiceAiThinking, setVoiceAiThinking] = useState(false);
  const [voiceAiSpeaking, setVoiceAiSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceAiTranscript, setVoiceAiTranscript] = useState('');
  const voiceAiTranscriptRef = useRef('');
  const [voiceAiReply, setVoiceAiReply] = useState('');
  const isSpeakingRef = useRef(false);
  const [activeEngine, setActiveEngine] = useState('');
  const [camOn, setCamOn] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);
  const [voicesLoaded, setVoicesLoaded] = useState(false);

  // Initialize voices
  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) {
        setVoicesLoaded(true);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  const silenceTimerRef = useRef<any>(null);
  const [voiceAiLang, setVoiceAiLang] = useState<'en-IN' | 'ml-IN'>('en-IN');
  const [micActivity, setMicActivity] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const [showVoiceHelp, setShowVoiceHelp] = useState(false);

  const startMonitoring = async () => {
    if (audioContextRef.current) return;
    try {
      setMicError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateActivity = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setMicActivity(average);
        requestAnimationFrame(updateActivity);
      };
      updateActivity();
    } catch (e: any) {
      console.error("Mic monitoring failed:", e);
      setMicError(e.message || "Microphone access denied or failed.");
    }
  };

  const stopMonitoring = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setMicActivity(0);
  };

  // Safety valve for stuck starting state
  useEffect(() => {
    const interval = setInterval(() => {
      if (isStartingRef.current) {
        console.warn("Recognition start timed out, resetting flag.");
        isStartingRef.current = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-restart if listening for too long without any results
  useEffect(() => {
    if (voiceAiListening && !voiceAiTranscript && voiceAiOn) {
      const timer = setTimeout(() => {
        if (voiceAiListening && !voiceAiTranscript && voiceAiOn) {
          console.warn("Listening for 15s with no transcript, performing soft restart...");
          if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch(e) {}
          }
        }
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [voiceAiListening, voiceAiTranscript, voiceAiOn]);

  // Knowledge Base
  const [kbDocs, setKbDocs] = useState<any[]>([
    { id: 1, category: 'railway', name: 'Railways Act, 1989.pdf', size: '2.4 MB', date: '2026-01-12', pages: 184 },
    { id: 2, category: 'property', name: 'Transfer of Property Act, 1882.pdf', size: '960 KB', date: '2025-10-05', pages: 78 },
  ]);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
  const [scannedDocs, setScannedDocs] = useState<any[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [kbFilter, setKbFilter] = useState('all');
  const [kbSearch, setKbSearch] = useState('');

  // Archive State
  const [archivedClients, setArchivedClients] = useState<any[]>([]);
  const [archivedDrafts, setArchivedDrafts] = useState<any[]>([]);
  const [archivedScans, setArchivedScans] = useState<any[]>([]);
  const [archivedUploads, setArchivedUploads] = useState<any[]>([]);
  const [archiveTab, setArchiveTab] = useState<'clients' | 'drafts' | 'scans' | 'uploads'>('clients');

  // Temp Instructions
  const [tempInstructions, setTempInstructions] = useState<any[]>([
    { id: 1, text: 'If Raju calls, tell him to meet me tomorrow at 10 AM.', active: true, created: '2026-03-06 09:00' },
  ]);
  const [newInstruction, setNewInstruction] = useState('');

  // Command Center - Call Logs
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [callViewTab, setCallViewTab] = useState<'log' | 'transcript'>('log');

  // AI Auto-Answer Simulation
  const [autoAnswerEnabled, setAutoAnswerEnabled] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [isAnswering, setIsAnswering] = useState(false);

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
      try {
        await localDB.init();
        setIsDbReady(true);

        // Check Auth & Configuration after DB is ready
        const response = await axios.get('/api/ai/status');
        setIsLoggedIn(response.data.isLoggedIn);
        setAiStatus(response.data);
        
        const onboardingComplete = localStorage.getItem('onboarding_complete') === 'true';
        const localKey = localStorage.getItem('nexus_gemini_api_key');
        
        // Check SQLite for key as well
        const dbKey = localDB.getConfig('gemini_api_key');
        if (dbKey && (!localKey || localKey === 'true' || localKey.length < 20)) {
          localStorage.setItem('nexus_gemini_api_key', dbKey);
          aiEngine.setApiKey(dbKey);
        }

        const effectiveKey = (localKey && localKey.length > 20) ? localKey : dbKey;
        if (effectiveKey && effectiveKey.length > 20) {
          aiEngine.setApiKey(effectiveKey);
        }
        const isConfigured = response.data.geminiConfigured || (effectiveKey && effectiveKey.length > 20);
        
        console.log("Nexus Auth Check:", { isLoggedIn: response.data.isLoggedIn, onboardingComplete, isConfigured });
        
        if (response.data.isLoggedIn) {
          setUser({
            displayName: 'Advocate',
            email: 'user@nexus.justice',
            photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=advocate'
          });
        }

        if (onboardingComplete && isConfigured) {
          setShowOnboarding(false);
        } else if (isConfigured) {
          setOnboardingStep(4);
          setShowOnboarding(true);
        } else if (response.data.isLoggedIn) {
          setOnboardingStep(2);
          setShowOnboarding(true);
        } else {
          setShowOnboarding(true);
          setOnboardingStep(1);
        }
        setIsAuthReady(true);

        const savedClients = localDB.query("SELECT * FROM clients WHERE is_archived = 0") as any[];
        if (savedClients.length > 0) {
          const parsedClients = savedClients.map(c => ({
            ...c,
            documents: c.documents ? JSON.parse(c.documents) : []
          }));
          setClients(parsedClients);
        } else {
          const initial = [
            { id: 1, name: 'Sreedharan K.', phone: '+91 9876543210', court: 'District Court, Aluva', case_number: 'OS 145/2025', next_date: '2026-03-15', purpose: 'Filing Written Statement', opp_advocate_name: 'Adv. Rajan P.', opp_advocate_phone: '+91 9988776655', documents: [] },
            { id: 2, name: 'Elena Rodriguez', phone: '+1 555-0199', court: 'High Court', case_number: 'WP(C) 204/2026', next_date: '2026-03-20', purpose: 'Hearing', opp_advocate_name: 'Adv. Smith', opp_advocate_phone: '+1 555-0200', documents: [] },
          ];
          initial.forEach(c => {
            localDB.run("INSERT INTO clients (name, phone, case_number, court, next_date, purpose, opp_advocate_name, opp_advocate_phone, documents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", 
              [c.name, c.phone, c.case_number, c.court, c.next_date, c.purpose, c.opp_advocate_name, c.opp_advocate_phone, JSON.stringify(c.documents)]);
          });
          setClients(initial);
        }

        const archivedClientsFromDb = localDB.query("SELECT * FROM clients WHERE is_archived = 1") as any[];
        setArchivedClients(archivedClientsFromDb.map(c => ({
          ...c,
          documents: c.documents ? JSON.parse(c.documents) : []
        })));

        const savedHistory = localDB.query("SELECT * FROM chat_history ORDER BY id ASC") as any[];
        if (savedHistory.length > 0) {
          setChatHistory(savedHistory.map(h => ({ id: h.id, role: h.role, content: h.content, engine: h.engine })));
        }

        const savedDraftsFromDb = localDB.query("SELECT * FROM drafts WHERE is_archived = 0 ORDER BY timestamp DESC") as any[];
        if (savedDraftsFromDb.length > 0) {
          setSavedDrafts(savedDraftsFromDb);
        }
        setArchivedDrafts(localDB.query("SELECT * FROM drafts WHERE is_archived = 1 ORDER BY timestamp DESC") as any[]);

        const savedScansFromDb = localDB.query("SELECT * FROM scanned_docs WHERE is_archived = 0 ORDER BY timestamp DESC") as any[];
        if (savedScansFromDb.length > 0) {
          setScannedDocs(savedScansFromDb);
        }
        setArchivedScans(localDB.query("SELECT * FROM scanned_docs WHERE is_archived = 1 ORDER BY timestamp DESC") as any[]);

        const savedUploadsFromDb = localDB.query("SELECT * FROM knowledge_docs WHERE is_archived = 0 ORDER BY timestamp DESC") as any[];
        if (savedUploadsFromDb.length > 0) {
          setUploadedDocs(savedUploadsFromDb);
        }
        setArchivedUploads(localDB.query("SELECT * FROM knowledge_docs WHERE is_archived = 1 ORDER BY timestamp DESC") as any[]);

        const savedInstructionsFromDb = localDB.query("SELECT * FROM instructions ORDER BY timestamp DESC") as any[];
        if (savedInstructionsFromDb.length > 0) {
          setTempInstructions(savedInstructionsFromDb);
        }
      } catch (err) {
        console.error("Database initialization failed:", err);
        setIsAuthReady(true);
      }
      
      const checkStatus = async () => {
        const status = aiEngine.getStatus();
        setAiStatus(status);
      };
      
      checkStatus();
      const statusInterval = setInterval(checkStatus, 10000);
      
      // No longer force onboarding here as it's handled in the main auth check
      // if (!localStorage.getItem('onboarding_complete')) {
      //   setShowOnboarding(true);
      //   setOnboardingStep(1);
      // }

      return () => clearInterval(statusInterval);
    };
    init();

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const handleKbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      const size = (file.size / 1024).toFixed(1) + ' KB';
      
      const id = localDB.run(
        "INSERT INTO knowledge_docs (name, type, data, size) VALUES (?, ?, ?, ?)",
        [file.name, file.type, base64Data, size]
      );

      if (id) {
        const newDoc = { id, name: file.name, type: file.type, data: base64Data, size, timestamp: new Date().toISOString() };
        setUploadedDocs(prev => [newDoc, ...prev]);
        setNotifications(prev => [{ id: Date.now(), message: `Document "${file.name}" uploaded to Knowledge Base.`, date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
        speak(`Document ${file.name} successfully uploaded.`);
      }
    };
    reader.readAsDataURL(file);
  };

  const deleteKbItem = (type: 'draft' | 'scan' | 'upload', id: number, permanent = false) => {
    let table = '';
    if (type === 'draft') table = 'drafts';
    else if (type === 'scan') table = 'scanned_docs';
    else if (type === 'upload') table = 'knowledge_docs';

    if (table) {
      if (permanent) {
        localDB.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
        if (type === 'draft') setArchivedDrafts(prev => prev.filter(d => d.id !== id));
        else if (type === 'scan') setArchivedScans(prev => prev.filter(d => d.id !== id));
        else if (type === 'upload') setArchivedUploads(prev => prev.filter(d => d.id !== id));
        speak("Item deleted permanently.");
      } else {
        localDB.run(`UPDATE ${table} SET is_archived = 1 WHERE id = ?`, [id]);
        if (type === 'draft') {
          const item = savedDrafts.find(d => d.id === id);
          setSavedDrafts(prev => prev.filter(d => d.id !== id));
          if (item) setArchivedDrafts(prev => [item, ...prev]);
        } else if (type === 'scan') {
          const item = scannedDocs.find(d => d.id === id);
          setScannedDocs(prev => prev.filter(d => d.id !== id));
          if (item) setArchivedScans(prev => [item, ...prev]);
        } else if (type === 'upload') {
          const item = uploadedDocs.find(d => d.id === id);
          setUploadedDocs(prev => prev.filter(d => d.id !== id));
          if (item) setArchivedUploads(prev => [item, ...prev]);
        }
        speak("Item moved to archive.");
      }
      
      setNotifications(prev => [{ id: Date.now(), message: permanent ? "Item deleted permanently." : "Item moved to archive.", date: new Date().toISOString().split('T')[0], read: false, type: 'info' }, ...prev]);
    }
  };

  const restoreKbItem = (type: 'draft' | 'scan' | 'upload', id: number) => {
    let table = '';
    if (type === 'draft') table = 'drafts';
    else if (type === 'scan') table = 'scanned_docs';
    else if (type === 'upload') table = 'knowledge_docs';

    if (table) {
      localDB.run(`UPDATE ${table} SET is_archived = 0 WHERE id = ?`, [id]);
      if (type === 'draft') {
        const item = archivedDrafts.find(d => d.id === id);
        setArchivedDrafts(prev => prev.filter(d => d.id !== id));
        if (item) setSavedDrafts(prev => [item, ...prev]);
      } else if (type === 'scan') {
        const item = archivedScans.find(d => d.id === id);
        setArchivedScans(prev => prev.filter(d => d.id !== id));
        if (item) setScannedDocs(prev => [item, ...prev]);
      } else if (type === 'upload') {
        const item = archivedUploads.find(d => d.id === id);
        setArchivedUploads(prev => prev.filter(d => d.id !== id));
        if (item) setUploadedDocs(prev => [item, ...prev]);
      }
      speak("Item restored from archive.");
      setNotifications(prev => [{ id: Date.now(), message: "Item restored successfully.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
    }
  };

  const archiveClient = (id: number) => {
    localDB.run("UPDATE clients SET is_archived = 1 WHERE id = ?", [id]);
    const client = clients.find(c => c.id === id);
    setClients(prev => prev.filter(c => c.id !== id));
    if (client) setArchivedClients(prev => [client, ...prev]);
    speak("Client moved to archive.");
    setNotifications(prev => [{ id: Date.now(), message: "Client archived.", date: new Date().toISOString().split('T')[0], read: false, type: 'info' }, ...prev]);
  };

  const restoreClient = (id: number) => {
    localDB.run("UPDATE clients SET is_archived = 0 WHERE id = ?", [id]);
    const client = archivedClients.find(c => c.id === id);
    setArchivedClients(prev => prev.filter(c => c.id !== id));
    if (client) setClients(prev => [client, ...prev]);
    speak("Client restored from archive.");
    setNotifications(prev => [{ id: Date.now(), message: "Client restored.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
  };

  const deleteClientPermanently = (id: number) => {
    localDB.run("DELETE FROM clients WHERE id = ?", [id]);
    setArchivedClients(prev => prev.filter(c => c.id !== id));
    speak("Client deleted permanently.");
    setNotifications(prev => [{ id: Date.now(), message: "Client deleted permanently.", date: new Date().toISOString().split('T')[0], read: false, type: 'info' }, ...prev]);
  };

  const handleAddInstruction = () => {
    if (!newInstruction.trim()) return;
    
    const id = localDB.run("INSERT INTO instructions (text) VALUES (?)", [newInstruction]);
    if (id) {
      const newItem = { id, text: newInstruction, timestamp: new Date().toISOString(), active: 1 };
      setTempInstructions(prev => [newItem, ...prev]);
      setNewInstruction('');
      setNotifications(prev => [{ id: Date.now(), message: "New instruction added.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
      speak("Instruction added.");
    }
  };

  const deleteInstruction = (id: number) => {
    localDB.run("DELETE FROM instructions WHERE id = ?", [id]);
    setTempInstructions(prev => prev.filter(i => i.id !== id));
    setNotifications(prev => [{ id: Date.now(), message: "Instruction deleted.", date: new Date().toISOString().split('T')[0], read: false, type: 'info' }, ...prev]);
    speak("Instruction removed.");
  };

  // --- AI Logic ---
  const sendConsult = async (initialText?: string) => {
    const text = initialText || consoleInput.trim();
    if (!text || consoleLoading) return;
    if (!initialText) setConsoleInput("");
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const userId = localDB.run("INSERT INTO chat_history (role, content) VALUES (?, ?)", ['user', text]);
    const updatedHistory: AIMessage[] = [...chatHistory, { id: userId || undefined, role: 'user', content: text }];
    setChatHistory(updatedHistory);
    setConsoleLoading(true);

    try {
      const response = await aiEngine.generateResponse(
        text, 
        chatHistory, 
        undefined, // forcedEngine
        undefined, // imageBase64
        abortControllerRef.current.signal,
        (status) => setVoiceAiStatus(status)
      );
      const aiId = localDB.run("INSERT INTO chat_history (role, content, engine) VALUES (?, ?, ?)", ['assistant', response.text, response.engine]);
      setChatHistory(prev => [...prev, { id: aiId || undefined, role: 'assistant', content: response.text, engine: response.engine }]);
      speakResponse(response.text);
    } catch (err) {
      if (err instanceof Error && err.message === "Aborted") {
        console.log("Consult request aborted");
      } else {
        console.error(err);
        const errorMsg = "Nexus AI: I'm sorry, I encountered an error while processing your request. Please try again or check your connection.";
        setChatHistory(prev => [...prev, { role: 'assistant', content: errorMsg, engine: 'Error' }]);
      }
    } finally {
      setConsoleLoading(false);
      setVoiceAiStatus("");
    }
  };

  const handleClientDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const doc = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + ' KB',
      type: file.type,
      timestamp: new Date().toISOString()
    };
    setNewClient(prev => ({ ...prev, documents: [...prev.documents, doc] }));
  };

  const handleAddClient = async () => {
    console.log("Nexus: handleAddClient triggered", newClient);
    if (!newClient.name || !newClient.phone) {
      setNotifications(prev => [{ 
        id: Date.now(), 
        message: "Validation Error: Name and Phone Number are required.", 
        date: new Date().toISOString().split('T')[0], 
        read: false, 
        type: 'error' 
      }, ...prev]);
      return;
    }
    
    setIsRegistering(true);
    
    // Simulate "entering data" delay for graphic indication
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const docsJson = JSON.stringify(newClient.documents);
      const id = localDB.run("INSERT INTO clients (name, phone, case_number, court, next_date, purpose, opp_advocate_name, opp_advocate_phone, documents) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [newClient.name, newClient.phone, newClient.case_number, newClient.court, newClient.next_date, newClient.purpose, newClient.opp_advocate_name, newClient.opp_advocate_phone, docsJson]);
      
      if (id) {
        console.log("Nexus: Client registered with ID:", id);
        setClients(prev => [...prev, { ...newClient, id }]);
        
        // Show success overlay
        setShowSuccessOverlay(true);
        setTimeout(() => {
          setShowSuccessOverlay(false);
          setAddingClient(false);
          setNewClient({ name: '', phone: '', case_number: '', court: '', next_date: '', purpose: '', opp_advocate_name: '', opp_advocate_phone: '', documents: [] });
        }, 2000);

        setNotifications(prev => [{ 
          id: Date.now(), 
          message: `Success: Client details Entered for ${newClient.name}.`, 
          date: new Date().toISOString().split('T')[0], 
          read: false, 
          type: 'success' 
        }, ...prev]);
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#6366f1', '#a855f7', '#ec4899']
        });
      } else {
        throw new Error("Failed to insert client into database.");
      }
    } catch (err) {
      console.error("Nexus: handleAddClient Error:", err);
      setNotifications(prev => [{ 
        id: Date.now(), 
        message: "Database Error: Failed to register client. Please try again.", 
        date: new Date().toISOString().split('T')[0], 
        read: false, 
        type: 'error' 
      }, ...prev]);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteDocument = (clientId: number, docId: number) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const updatedDocs = client.documents.filter((d: any) => d.id !== docId);
    const docsJson = JSON.stringify(updatedDocs);

    try {
      localDB.run("UPDATE clients SET documents = ? WHERE id = ?", [docsJson, clientId]);
      
      // Update local state
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, documents: updatedDocs } : c));
      
      // Update viewingDocsClient if it's the same client
      if (viewingDocsClient && viewingDocsClient.id === clientId) {
        setViewingDocsClient({ ...viewingDocsClient, documents: updatedDocs });
      }

      setNotifications(prev => [{ 
        id: Date.now(), 
        message: "Document deleted successfully.", 
        date: new Date().toISOString().split('T')[0], 
        read: false, 
        type: 'success' 
      }, ...prev]);
    } catch (err) {
      console.error("Nexus: handleDeleteDocument Error:", err);
      setNotifications(prev => [{ 
        id: Date.now(), 
        message: "Error deleting document. Please try again.", 
        date: new Date().toISOString().split('T')[0], 
        read: false, 
        type: 'error' 
      }, ...prev]);
    }
  };

  const sendDeskChat = async () => {
    if (!deskInput.trim() || deskLoading) return;
    const text = deskInput.trim();
    setDeskInput("");

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setDeskChatHistory(prev => [...prev, { role: 'user', text }]);
    setDeskLoading(true);

    try {
      const response = await aiEngine.generateResponse(
        text, 
        [], 
        'gemini', // Gemini is the voice assistant helping the advocate
        undefined, // imageBase64
        abortControllerRef.current.signal,
        (status) => setVoiceAiStatus(status)
      );
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: response.text, engine: response.engine }]);
      speakResponse(response.text);
    } catch (err) {
      if (err instanceof Error && err.message === "Aborted") {
        console.log("Desk chat request aborted");
      } else {
        console.error(err);
        setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Error: Failed to get response from AI.", engine: 'Error' }]);
      }
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const simulateIncomingCall = () => {
    const call = {
      id: Date.now(),
      clientName: "Raju Varma",
      phone: "+91 9447001122",
      timestamp: new Date().toLocaleString(),
      duration: "0s",
      transcript: [],
      summary: "Incoming Call..."
    };
    setIncomingCall(call);
    
    if (autoAnswerEnabled) {
      setTimeout(() => handleAutoAnswer(call), 2000);
    }
  };

  const handleAutoAnswer = async (call: any) => {
    setIsAnswering(true);
    const instructions = tempInstructions.filter(i => i.active).map(i => i.text).join(". ");
    const prompt = `A client named ${call.clientName} is calling. 
    Current Instructions: ${instructions || "The advocate is currently busy, but I can take a message or provide basic guidance based on your previous cases."}
    
    Please provide a professional, helpful response as the AI Assistant for the advocate. Keep it concise.`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini');
      const aiResponse = response.text;
      
      const updatedCall = {
        ...call,
        duration: "45s",
        transcript: [
          { role: "client", text: "Hello? Is the advocate there?" },
          { role: "ai", text: aiResponse }
        ],
        summary: `AI Auto-Answered (Gemini): ${aiResponse.substring(0, 50)}...`
      };

      // In a real app, we'd add to SIMULATED_CALLS or DB
      setNotifications(prev => [{
        id: Date.now(),
        message: `AI Auto-Answered a call from ${call.clientName} using Gemini.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        type: 'call'
      }, ...prev]);
      
      // Speak the response
      speakResponse(aiResponse);
    } catch (err) {
      console.error("Auto-answer failed:", err);
    } finally {
      setTimeout(() => {
        setIncomingCall(null);
        setIsAnswering(false);
      }, 4000);
    }
  };

  // --- Document Converter Logic ---
  const handleConverterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConverterPhase('scanning');
    setVoiceAiStatus("Reading File...");
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const text = await aiEngine.performOCR(base64);
        if (text && text.trim().length > 0) {
          setConverterInputText(text);
          setNotifications(prev => [{ id: Date.now(), message: "Document text extracted successfully.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
        } else {
          setNotifications(prev => [{ id: Date.now(), message: "No clear text found in the uploaded file.", date: new Date().toISOString().split('T')[0], read: false, type: 'warning' }, ...prev]);
        }
      } catch (err) {
        console.error("OCR failed:", err);
        setNotifications(prev => [{ id: Date.now(), message: "Failed to read document.", date: new Date().toISOString().split('T')[0], read: false, type: 'error' }, ...prev]);
      } finally {
        setConverterPhase('idle');
        setVoiceAiStatus("");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConverterCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setConverterPhase('scanning');
    setVoiceAiStatus("Capturing Image...");
    
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
    
    try {
      const text = await aiEngine.performOCR(imageBase64);
      if (text && text.trim().length > 0) {
        setConverterInputText(text);
        setNotifications(prev => [{ id: Date.now(), message: "Document captured and read.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
      } else {
        setNotifications(prev => [{ id: Date.now(), message: "No clear text found. Try adjusting the camera or lighting.", date: new Date().toISOString().split('T')[0], read: false, type: 'warning' }, ...prev]);
      }
    } catch (err) {
      console.error("Capture OCR failed:", err);
    } finally {
      setConverterPhase('idle');
      setVoiceAiStatus("");
    }
  };

  const handleTranslateDoc = async () => {
    if (!converterInputText.trim()) return;
    setIsConverting(true);
    setConverterPhase('translating');
    setVoiceAiStatus("Translating (Gemini)...");
    
    try {
      const prompt = `Translate the following text to ${converterTargetLang}. Keep the legal terminology accurate.
      
      TEXT:
      ${converterInputText}`;
      
      const response = await aiEngine.generateResponse(prompt, [], 'gemini');
      const translated = response.text;
      if (translated) {
        setConverterTranslatedText(translated);
        setNotifications(prev => [{ id: Date.now(), message: "Document translated successfully.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
      }
    } catch (err) {
      console.error("Translation failed:", err);
    } finally {
      setIsConverting(false);
      setConverterPhase('idle');
      setVoiceAiStatus("");
    }
  };

  const downloadAsPDF = (text: string, filename: string) => {
    const doc = new jsPDF();
    const splitText = doc.splitTextToSize(text, 180);
    doc.text(splitText, 15, 15);
    doc.save(`${filename}.pdf`);
  };

  const downloadAsWord = async (text: string, filename: string) => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun(text)],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${filename}.docx`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setNotifications(prev => [{ id: Date.now(), message: "Copied to clipboard.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
  };

  const deleteConverterDoc = () => {
    setConverterInputText("");
    setConverterTranslatedText("");
    setNotifications(prev => [{ id: Date.now(), message: "Document cleared.", date: new Date().toISOString().split('T')[0], read: false, type: 'info' }, ...prev]);
  };
  const startScan = async () => {
    setScanError(''); setScanPhase('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanPhase('live');
    } catch (err) {
      setScanError('Camera access denied.'); setScanPhase('error');
    }
  };

  const captureScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setScanPhase('processing');
    setScanProgress(10);
    setVoiceAiStatus("Capturing Image...");
    
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
    
    try {
      setVoiceAiStatus("Scanning Text (ML Kit)...");
      // Use the new OCR service
      const extractedText = await aiEngine.performOCR(imageBase64, (progress) => {
        setScanProgress(10 + Math.round(progress * 0.4)); // 10% to 50%
      });

      setScannedText(extractedText || "");
      setScanProgress(60);
      setVoiceAiStatus("Gemini is reading...");

      // Now use Gemini to analyze the document image
      const visionPrompt = `I have scanned a legal document. Please analyze this document, identify the parties involved, the main obligations, and any potential legal risks. Use a professional legal tone.`;

      const response = await aiEngine.generateResponse(
        visionPrompt, 
        [], 
        'gemini', 
        imageBase64, 
        undefined, 
        (status) => setVoiceAiStatus(status)
      );
      
      if (response && response.text) {
        const baseText = extractedText ? `--- EXTRACTED TEXT ---\n${extractedText}\n\n` : "";
        const finalContent = `${baseText}--- GEMINI ANALYSIS ---\n${response.text}`;
        setScannedText(finalContent);
        speakResponse(response.text);
        saveScanToDb(finalContent, imageBase64);
      } else if (extractedText && extractedText.trim().length >= 5) {
        // Fallback to Gemini if vision analysis fails but we have OCR text
        setVoiceAiStatus("Gemini is reading...");
        const summaryPrompt = `I have scanned a legal document. Here is the extracted text:
        
        --- START OF TEXT ---
        ${extractedText}
        --- END OF TEXT ---
        
        Please analyze this document, identify the parties involved, the main obligations, and any potential legal risks. Use a professional legal tone.`;

        const response = await aiEngine.generateResponse(
          summaryPrompt, 
          [], 
          'gemini', 
          undefined, 
          undefined, 
          (status) => setVoiceAiStatus(status)
        );

        setScannedText(prev => `--- EXTRACTED TEXT ---\n${prev}\n\n--- GEMINI ANALYSIS ---\n${response.text}`);
        speakResponse(response.text);
      } else {
        // Both failed
        throw new Error("No clear text found and AI analysis failed. Please ensure the document is well-lit and clearly visible.");
      }

      setScanPhase('done');
      setScanProgress(100);
    } catch (err: any) {
      console.error("Scan failed:", err);
      setScanError(err.message || 'AI analysis failed.');
      setScanPhase('error');
    } finally {
      setVoiceAiStatus("");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  // --- Voice AI Logic ---
  const chatHistoryRef = useRef(chatHistory);
  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  const sanitizeForSpeech = (text: string) => {
    return text
      .replace(/\[Offline Mode\]/gi, '')
      .replace(/\[Offline Vision Mode\]/gi, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/#{1,6}\s+/g, '')
      .replace(/>\s+/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/`{1,3}[^`]*`{1,3}/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const downloadResponse = (text: string, filename: string = 'ai_response.txt') => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Writing Desk Enhanced Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDraftingModel(event.target?.result as string);
        setNotifications(prev => [{
          id: Date.now(),
          message: `Drafting model "${file.name}" uploaded successfully.`,
          date: new Date().toISOString().split('T')[0],
          read: false,
          type: 'info'
        }, ...prev]);
      };
      reader.readAsText(file);
    }
  };

  const handleDownloadDraft = () => {
    const text = draftPages.join('\n\n---\n\n');
    downloadResponse(text, `Case_Draft_${Date.now()}.txt`);
  };

  const generateDraft = async () => {
    if (!caseFacts.trim()) {
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Please provide some facts first.", engine: 'Nexus AI' }]);
      return;
    }
    
    setDeskLoading(true);
    setVoiceAiStatus("Gemini is drafting...");
    
    const prompt = `Draft a legal petition/plaint based on the following facts:
    
    FACTS:
    ${caseFacts}
    
    ${draftingModel ? `USE THIS MODEL/TEMPLATE AS A GUIDE:\n${draftingModel}` : ''}
    
    Please provide a professional legal draft.`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      setDraftPages([response.text]);
      setDeskChatHistory(prev => [...prev, { role: 'user', text: "Generate Draft" }, { role: 'ai', text: "Draft generated. Now analyzing for suggestions...", engine: 'Gemini' }]);
      
      // Get suggestions after drafting
      await getAiSuggestions(response.text);
      setWritingDeskPhase('suggestions');
      setShowSuggestionsDropdown(true);
    } catch (err) {
      console.error(err);
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Drafting failed. Please try again.", engine: 'Error' }]);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const getAiSuggestions = async (draft: string) => {
    setVoiceAiStatus("Gemini is analyzing for suggestions...");
    const prompt = `Analyze this legal draft and provide 5-6 specific, legally helpful suggestions or missing points. 
    Format each suggestion on a new line starting with a bullet point.
    
    DRAFT:
    ${draft}`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      const suggestions = response.text.split('\n')
        .filter(s => s.trim().length > 10)
        .map(s => ({ text: s.replace(/^[-*•]\s*/, '').trim(), selected: false }));
      setAiSuggestionsList(suggestions);
    } catch (err) {
      console.error(err);
    }
  };

  const getRelatedCases = async () => {
    setDeskLoading(true);
    setVoiceAiStatus("Gemini is searching for related cases...");
    
    const selectedSuggestions = aiSuggestionsList.filter(s => s.selected).map(s => s.text).join('\n');
    
    const prompt = `Based on the following case facts and selected legal points, find 3-4 important related Indian court cases with official citations.
    For each case, provide:
    1. Citation (e.g., AIR 2020 SC 123)
    2. Brief description of the ruling.
    
    FACTS:
    ${caseFacts}
    
    SELECTED POINTS:
    ${selectedSuggestions}
    
    Please use official portals for citations.`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      const cases = response.text.split('\n\n').filter(c => c.trim().length > 20).map(c => ({
        citation: c.split('\n')[0].replace(/^\d+\.\s*/, '').trim(),
        description: c.split('\n').slice(1).join(' ').trim(),
        selected: false,
        placement: '',
        reason: ''
      }));
      setRelatedCasesList(cases);
      setWritingDeskPhase('cases');
      setShowCasesDropdown(true);
    } catch (err) {
      console.error(err);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const recreateDraft = async () => {
    setDeskLoading(true);
    setVoiceAiStatus("Gemini is recreating the final draft...");
    
    const selectedSuggestions = aiSuggestionsList.filter(s => s.selected).map(s => s.text).join('\n');
    const selectedCases = relatedCasesList.filter(c => c.selected).map(c => `CASE: ${c.citation}\nPLACEMENT: ${c.placement}\nREASON: ${c.reason}`).join('\n\n');
    
    const prompt = `Recreate the legal draft incorporating the following selected legal points and case citations.
    
    ORIGINAL FACTS:
    ${caseFacts}
    
    SELECTED LEGAL POINTS:
    ${selectedSuggestions}
    
    SELECTED CASE CITATIONS:
    ${selectedCases}
    
    PREVIOUS DRAFT:
    ${draftPages[0]}
    
    Please provide the final, polished legal draft.`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      setDraftPages([response.text]);
      setWritingDeskPhase('final');
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Final draft recreated with all your selections. Please review it.", engine: 'Gemini' }]);
    } catch (err) {
      console.error(err);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const getAiGuidance = async () => {
    if (!caseFacts.trim()) return;
    setVoiceAiStatus("Gemini is analyzing facts...");
    const prompt = `You are a helpful legal assistant. Analyze the following case facts provided by an advocate. 
    If any legally important information is missing (e.g., dates, specific locations, party details, specific incidents), ask 3-4 clarifying questions to help the advocate refine the facts for drafting.
    If the facts are sufficient, provide guidance on the legal strategy.
    
    FACTS:
    ${caseFacts}`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      const questions = response.text.split('\n').filter(q => q.trim().length > 5).slice(0, 4);
      setAiQuestions(questions);
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: response.text, engine: 'Gemini' }]);
    } catch (err) {
      console.error(err);
    }
  };

  const integrateSuggestion = async (suggestion: string) => {
    setDeskLoading(true);
    setVoiceAiStatus("Gemini is integrating suggestion...");
    const prompt = `Update the following legal draft by integrating this suggestion: "${suggestion}"
    
    CURRENT DRAFT:
    ${draftPages[0]}`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      setDraftPages([response.text]);
      setAiSuggestions(prev => prev.filter(s => s !== suggestion));
    } catch (err) {
      console.error(err);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const saveDraftToDb = () => {
    if (!draftPages[0].trim()) return;
    const title = draftPages[0].split('\n')[0].replace(/[#*]/g, '').trim().slice(0, 50) || "Untitled Draft";
    const id = localDB.run("INSERT INTO drafts (title, content, case_facts) VALUES (?, ?, ?)", [title, draftPages[0], caseFacts]);
    if (id) {
      setSavedDrafts(prev => [{ id, title, content: draftPages[0], case_facts: caseFacts, timestamp: new Date().toISOString() }, ...prev]);
      setNotifications(prev => [{ id: Date.now(), message: `Draft "${title}" saved to Knowledge Base.`, date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
    }
  };

  const saveScanToDb = (content: string, imageBase64?: string) => {
    if (!content.trim()) return;
    const title = "Scanned Document " + new Date().toLocaleString();
    const id = localDB.run("INSERT INTO scanned_docs (title, content, image_base64) VALUES (?, ?, ?)", [title, content, imageBase64 || ""]);
    if (id) {
      setScannedDocs(prev => [{ id, title, content, image_base64: imageBase64 || "", timestamp: new Date().toISOString() }, ...prev]);
      setNotifications(prev => [{ id: Date.now(), message: `Scan saved to Knowledge Base.`, date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecordFacts = async () => {
    if (isRecordingFacts) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecordingFacts(false);
      setVoiceAiStatus("");
    } else {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert("Speech recognition not supported in this browser.");
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          if (finalTranscript) {
            setCaseFacts(prev => prev + (prev ? ' ' : '') + finalTranscript);
          }
        };

        recognition.onstart = () => {
          setIsRecordingFacts(true);
          setVoiceAiStatus("Recording facts (Browser STT)...");
        };

        recognition.onend = () => {
          setIsRecordingFacts(false);
          setVoiceAiStatus("");
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecordingFacts(false);
          setVoiceAiStatus("");
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Failed to start recording:", err);
        alert("Microphone access denied or not supported.");
      }
    }
  };

  const deleteMessage = (index: number) => {
    const msg = chatHistory[index];
    if (msg?.id) {
      localDB.run("DELETE FROM chat_history WHERE id = ?", [msg.id]);
    }
    setChatHistory(prev => prev.filter((_, i) => i !== index));
  };

  const deleteDeskMessage = (index: number) => {
    setDeskChatHistory(prev => prev.filter((_, i) => i !== index));
  };

  const speakResponse = useCallback(async (text: string) => {
    if (!text) return;
    
    // Always use browser TTS in this version
    fallbackToBrowserTTS(text);
  }, []);

  const fallbackToBrowserTTS = (text: string) => {
    console.log("Falling back to Browser TTS. Text length:", text.length);
    // Ensure we have voices loaded
    if (window.speechSynthesis.getVoices().length === 0) {
      console.log("No voices yet, waiting for voiceschanged...");
      window.speechSynthesis.addEventListener('voiceschanged', () => fallbackToBrowserTTS(text), { once: true });
      return;
    }

    if (window.speechSynthesis.paused) {
      console.log("SpeechSynthesis was paused, resuming...");
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();
    
    // Set speaking state immediately
    setVoiceAiSpeaking(true);
    isSpeakingRef.current = true;
    
    const cleanText = sanitizeForSpeech(text);
    
    // Split text into smaller chunks (max 200 chars) for better reliability
    const chunks: string[] = [];
    const words = cleanText.split(' ');
    let currentChunk = '';
    
    words.forEach(word => {
      if ((currentChunk + word).length < 200) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        chunks.push(currentChunk);
        currentChunk = word;
      }
    });
    if (currentChunk) chunks.push(currentChunk);

    console.log(`Split text into ${chunks.length} chunks.`);

    let chunkIndex = 0;

    const speakNextChunk = () => {
      if (chunkIndex >= chunks.length) {
        console.log("All chunks spoken.");
        setVoiceAiSpeaking(false);
        isSpeakingRef.current = false;
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex]);
      utterance.volume = 1;
      utterance.rate = 1;
      
      // Detect Malayalam characters (\u0D00-\u0D7F)
      const hasMalayalam = /[\u0D00-\u0D7F]/.test(chunks[chunkIndex]);
      const lang = hasMalayalam ? 'ml-IN' : 'en-US';
      utterance.lang = lang;

      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.lang.startsWith(lang) && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha'))) 
                           || voices.find(v => v.lang.startsWith(lang));
      
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onstart = () => {
        console.log(`Started speaking chunk ${chunkIndex + 1}/${chunks.length}`);
        setVoiceAiSpeaking(true);
        isSpeakingRef.current = true;
      };

      utterance.onend = () => {
        console.log(`Finished chunk ${chunkIndex + 1}/${chunks.length}`);
        chunkIndex++;
        speakNextChunk();
      };

      utterance.onerror = (e) => {
        console.error(`Speech synthesis error on chunk ${chunkIndex + 1}:`, e);
        // Try next chunk anyway or stop
        chunkIndex++;
        if (chunkIndex < chunks.length) {
          speakNextChunk();
        } else {
          setVoiceAiSpeaking(false);
          isSpeakingRef.current = false;
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    // Some browsers require a small delay after cancel()
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        speakNextChunk();
      } catch (e) {
        console.error("Failed to start chunked speech synthesis:", e);
        setVoiceAiSpeaking(false);
        isSpeakingRef.current = false;
      }
    }, 250);
  };

  const isProcessingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const [voiceAiStatus, setVoiceAiStatus] = useState("");

  const processVoiceCommand = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    
    // Filter out very short, likely noise inputs (e.g., single characters)
    if (text.trim().length < 2) {
      setVoiceAiTranscript('');
      voiceAiTranscriptRef.current = '';
      return;
    }

    console.log("Processing voice command:", text);
    setIsProcessing(true);
    isProcessingRef.current = true;
    setView('consult'); // Switch to consult tab automatically
    setVoiceAiThinking(true);
    setVoiceAiStatus("Initializing...");
    
    // Add user message to history immediately so it shows up in the UI
    const userId = localDB.run("INSERT INTO chat_history (role, content) VALUES (?, ?)", ['user', text]);
    const updatedHistory: AIMessage[] = [...chatHistory, { id: userId || undefined, role: 'user', content: text }];
    setChatHistory(updatedHistory);
    
    // Ensure the transcript stays visible in the dock while thinking
    setVoiceAiTranscript(text);
    voiceAiTranscriptRef.current = '';
    
    setVoiceAiReply(''); 
    setActiveEngine('');
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      console.log("Calling AI Engine for voice command...");
      let imageBase64 = undefined;
      if (camOn && videoRef.current) {
        console.log("Capturing frame for multimodal voice command...");
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        imageBase64 = canvas.toDataURL('image/jpeg');
      }

      const response = await aiEngine.generateResponse(
        text, 
        chatHistory, 
        undefined, // forcedEngine
        imageBase64, 
        abortControllerRef.current.signal,
        (status) => setVoiceAiStatus(status)
      );
      console.log("AI Engine responded for voice command:", response.engine);
      
      // Now clear the transcript only when we have the reply
      setVoiceAiTranscript('');
      setVoiceAiReply(response.text);
      setActiveEngine(response.engine);
      setVoiceAiStatus("");
      const aiId = localDB.run("INSERT INTO chat_history (role, content, engine) VALUES (?, ?, ?)", ['assistant', response.text, response.engine]);
      setChatHistory(prev => [...prev, { id: aiId || undefined, role: 'assistant', content: response.text, engine: response.engine }]);
      speakResponse(response.text);
    } catch (err) {
      if (err instanceof Error && err.message === "Aborted") {
        console.log("Voice command aborted");
      } else {
        console.error(err);
        const errorMsg = "Nexus AI: I encountered an error processing your request.";
        setVoiceAiTranscript('');
        setVoiceAiReply(errorMsg);
        setActiveEngine('Error');
        speakResponse(errorMsg);
        setChatHistory(prev => [...prev, { role: 'assistant', content: errorMsg, engine: 'Error' }]);
      }
    } finally {
      setVoiceAiThinking(false);
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [camOn, speakResponse]);

  const startVoiceAi = useCallback(() => {
    if (isStartingRef.current) return;
    
    // Clean up existing if any
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.abort();
      } catch (e) {}
    }

    // Ensure AudioContext is resumed on user gesture
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    isStartingRef.current = true;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = voiceAiLang;

    recognition.onstart = () => {
      isStartingRef.current = false;
      // Guard: if AI is speaking, don't start listening
      if (window.speechSynthesis.speaking || voiceAiSpeaking || isSpeakingRef.current) {
        try { recognition.abort(); } catch(e) {}
        setVoiceAiListening(false);
        return;
      }
      setVoiceAiListening(true);
      setVoiceAiTranscript('');
      voiceAiTranscriptRef.current = '';
      setView('consult'); // Automatically open Consult page when listening starts

      // Initial silence timeout: if no speech at all for 12s, stop.
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current && !voiceAiTranscriptRef.current) {
          console.log("No speech detected after 12s, stopping.");
          try { recognitionRef.current.stop(); } catch(e) {}
        }
      }, 12000);
    };

    recognition.onspeechstart = () => {
      console.log("Speech detected...");
    };

    recognition.onsoundstart = () => {
      console.log("Sound detected...");
    };

    recognition.onresult = (event: any) => {
      // Guard: ignore results if AI is speaking to prevent feedback loops
      if (window.speechSynthesis.speaking || voiceAiSpeaking || isSpeakingRef.current) {
        try { recognition.abort(); } catch(e) {}
        return;
      }

      if (!event.results) return;

      let transcript = '';
      // Rebuild the entire transcript from all results to ensure continuity
      for (let i = 0; i < event.results.length; i++) {
        // Capture all results to avoid missing words
        transcript += event.results[i][0].transcript + ' ';
      }
      
      const trimmedTranscript = transcript.trim();
      if (trimmedTranscript) {
        setVoiceAiTranscript(trimmedTranscript);
        voiceAiTranscriptRef.current = trimmedTranscript;
      }

      // Silence detection: if we get a result, reset the timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          console.log("Silence detected after speech, stopping to process.");
          try { recognitionRef.current.stop(); } catch(e) {}
        }
      }, 5000); // 5 seconds of silence after speech detected (increased for better capture)
    };

    recognition.onend = () => {
      isStartingRef.current = false;
      setVoiceAiListening(false);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      // Guard: if AI is speaking, don't process the transcript (it's likely feedback)
      if (window.speechSynthesis.speaking || voiceAiSpeaking || isSpeakingRef.current) {
        voiceAiTranscriptRef.current = '';
        setVoiceAiTranscript('');
        return;
      }

      const finalTranscript = voiceAiTranscriptRef.current;
      if (finalTranscript.trim()) {
        processVoiceCommand(finalTranscript);
      } else {
        console.log("Recognition ended with no transcript.");
        // If it was a manual stop or timeout without speech, just reset
        if (!voiceAiThinking && !voiceAiSpeaking) {
          setVoiceAiTranscript('');
        }
      }
    };

    recognition.onerror = (event: any) => {
      isStartingRef.current = false;
      
      if (event.error === 'aborted') {
        console.log("Speech recognition aborted (normal lifecycle).");
      } else if (event.error === 'not-allowed') {
        console.error("Speech recognition error: not-allowed");
        alert("Microphone access was denied. Please check your browser settings.");
        setVoiceAiOn(false);
      } else if (event.error === 'network') {
        console.warn("Network error in speech recognition.");
      } else if (event.error === 'no-speech') {
        console.log("No speech detected.");
      } else {
        console.error("Speech recognition error:", event.error);
      }
      
      setVoiceAiListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      isStartingRef.current = false;
      console.warn("Recognition start failed:", e);
      setVoiceAiListening(false);
    }
  }, [processVoiceCommand, voiceAiLang]);

  useEffect(() => {
    if (voiceAiOn && recognitionRef.current && voiceAiListening) {
      recognitionRef.current.abort();
    }
  }, [voiceAiLang]);

  useEffect(() => {
    if (voiceAiOn && !isLiveMode && !voiceAiListening && !voiceAiThinking && !voiceAiSpeaking && !isProcessing && !isStartingRef.current) {
      const timer = setTimeout(() => {
        if (voiceAiOn && !isLiveMode && !voiceAiListening && !voiceAiThinking && !voiceAiSpeaking && !isProcessing && !isStartingRef.current) {
          startVoiceAi();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [voiceAiOn, isLiveMode, voiceAiListening, voiceAiThinking, voiceAiSpeaking, isProcessing, startVoiceAi]);

  const stopVoiceAi = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onspeechstart = null;
        recognitionRef.current.onsoundstart = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    // Removed window.speechSynthesis.cancel() from here to prevent accidental cutoff of AI speaking
    setVoiceAiOn(false);
    setVoiceAiListening(false);
    setVoiceAiSpeaking(false);
    isSpeakingRef.current = false;
    stopMonitoring();
  }, []);

  const testVoice = () => {
    speakResponse("This is a test of the Nexus Voice AI. If you can hear this, your audio is working correctly.");
  };

  const toggleVoiceAi = useCallback(() => {
    if (voiceAiOn) {
      stopVoiceAi();
    } else {
      setVoiceAiOn(true);
      startMonitoring();
      startVoiceAi();
      setView('consult');
    }
  }, [voiceAiOn, stopVoiceAi, startVoiceAi]);

  useEffect(() => {
    if (voiceAiOn) {
      if (isLiveMode) {
        stopVoiceAi();
      } else {
        startVoiceAi();
      }
    } else {
      stopVoiceAi();
    }
  }, [voiceAiOn, isLiveMode, stopVoiceAi, startVoiceAi]);

  const fixAudio = async () => {
    console.log("Fixing audio systems...");
    if (audioContextRef.current) {
      try { await audioContextRef.current.resume(); } catch(e) {}
    }
    if (audioContextLiveRef.current) {
      try { await audioContextLiveRef.current.resume(); } catch(e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      const v = new SpeechSynthesisUtterance("Audio system reset. I am ready to read.");
      v.volume = 1;
      v.rate = 1;
      window.speechSynthesis.speak(v);
    }
  };

  const resetVoiceAi = useCallback(() => {
    console.log("Resetting Voice AI...");
    fixAudio();
    if (abortControllerRef.current) abortControllerRef.current.abort();
    stopVoiceAi();
    setVoiceAiReply('');
    setVoiceAiThinking(false);
    setActiveEngine('');
    setVoiceAiTranscript('');
    voiceAiTranscriptRef.current = '';
    setIsProcessing(false);
    isProcessingRef.current = false;
    window.speechSynthesis.cancel();
    setVoiceAiSpeaking(false);
    isSpeakingRef.current = false;
    setMicError(null);
    setMicActivity(0);
    
    // Restart after a brief delay
    setTimeout(() => {
      toggleVoiceAi();
    }, 500);
  }, [stopVoiceAi, toggleVoiceAi]);

  const refreshAiStatus = useCallback(async () => {
    await aiEngine.updateStatus();
    const status = aiEngine.getStatus();
    setAiStatus(status);
  }, []);

  useEffect(() => {
    // No Ollama banner logic needed
    return () => {};
  }, [aiStatus.ollamaReady, aiStatus.offlineBrain]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw size={40} className="text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Initializing Nexus Justice...</p>
        </div>
      </div>
    );
  }

  // --- Sidebar & Tab Config ---
  const sideNav = [
    { id: 'command', label: 'Command', icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { id: 'feed', label: 'Archive', icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
    { id: 'consult', label: 'Consult', icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
    { id: 'clients', label: 'Clients', icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: 'knowledge-base', label: 'Knowledge', icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
    { id: 'temp-instructions', label: 'Instructions', icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" },
    { id: 'notifications', label: 'Notif.', icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" },
    { id: 'support', label: 'Support', icon: "M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" },
    { id: 'reading-room', label: 'Read', icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
    { id: 'doc-converter', label: 'Convert', icon: "M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { id: 'writing-desk', label: 'Writing', icon: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" },
    { id: 'config', label: 'Config', icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0" },
  ];

  const S = {
    page: { position: 'relative' as const, display: 'flex', height: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', fontSize: 14 },
    sidebar: { width: 72, background: '#070b14', borderRight: '1px solid rgba(255,255,255,.05)', display: 'none', flexDirection: 'column' as const, alignItems: 'center', padding: '20px 0', gap: 8, flexShrink: 0, overflowY: 'auto' as const },
    sidebarDesktop: { width: 72, background: '#070b14', borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '20px 0', gap: 8, flexShrink: 0, overflowY: 'auto' as const },
    sideBtn: (active: boolean) => ({ width: 44, height: 44, borderRadius: 12, background: active ? 'rgba(245,158,11,.1)' : 'transparent', border: active ? '1px solid rgba(245,158,11,.25)' : '1px solid transparent', color: active ? '#f59e0b' : '#475569', cursor: 'pointer', display: 'flex' as const, alignItems: 'center', justifyContent: 'center', position: 'relative' as const, transition: 'all .2s', flexShrink: 0 }),
    header: { height: 56, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 },
    card: { background: '#0a0f1d', borderRadius: 24, padding: 28, border: '1px solid rgba(255,255,255,.05)' },
  };

  return (
    <div style={S.page}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse2{0%,100%{opacity:.5}50%{opacity:1}}
        @keyframes scanLine{0%,100%{top:0%}50%{top:95%}}
        @keyframes waveBar{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}
        .fade-up{animation:fadeUp .35s ease forwards}
        .spin{animation:spin 1s linear infinite}
        .pulse-a{animation:pulse2 2s ease-in-out infinite}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.4);border-radius:4px}
        input,textarea,select{color:#e2e8f0;outline:none}
        input::placeholder,textarea::placeholder{color:#475569}
        .tab-scroll::-webkit-scrollbar{height:4px;display:block}
        .tab-scroll::-webkit-scrollbar-thumb{background:rgba(245,158,11,.4);border-radius:4px}
        .tab-scroll::-webkit-scrollbar-track{background:rgba(255,255,255,.02);border-radius:4px}
        button:focus{outline:none}
        .kb-drop{border:2px dashed rgba(99,102,241,.3);border-radius:20px;transition:all .2s}
        .kb-drop.over{border-color:#6366f1;background:rgba(99,102,241,.05)}
        .instr-card{transition:all .2s}
        .instr-card:hover{border-color:rgba(245,158,11,.2)!important}
        .markdown-body h1, .markdown-body h2, .markdown-body h3 { font-weight: 900; font-style: italic; margin-top: 1.2em; margin-bottom: 0.6em; color: #6366f1; letter-spacing: -0.02em; }
        .markdown-body h1 { font-size: 1.5em; }
        .markdown-body h2 { font-size: 1.3em; }
        .markdown-body h3 { font-size: 1.1em; }
        .markdown-body p { margin-bottom: 1.2em; line-height: 1.8; color: #cbd5e1; }
        .markdown-body ul, .markdown-body ol { margin-bottom: 1.2em; padding-left: 1.2em; list-style-position: outside; }
        .markdown-body li { margin-bottom: 0.6em; color: #cbd5e1; }
        .markdown-body strong { color: #f59e0b; font-weight: 900; }
        .markdown-body blockquote { border-left: 3px solid #6366f1; padding-left: 1.2em; color: #64748b; font-style: italic; margin: 1.5em 0; background: rgba(99,102,241,0.03); padding-top: 8px; padding-bottom: 8px; border-radius: 0 8px 8px 0; }
        .markdown-body code { background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #818cf8; }
        .markdown-body hr { border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 2em 0; }
      `}</style>

      {/* SIDEBAR */}
      <div className="hidden md:flex" style={S.sidebarDesktop}>
        <div style={{ width: 44, height: 44, background: '#f59e0b', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 12, boxShadow: '0 4px 20px rgba(245,158,11,.3)', flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#000', fontStyle: 'italic' }}>T</span>
        </div>
        {sideNav.map(item => (
          <button key={item.id} onClick={() => setView(item.id)} title={item.label} style={S.sideBtn(view === item.id)}>
            <Icon path={item.icon} size={18} />
            {view === item.id && <div style={{ position: 'absolute', left: 0, width: 3, height: 22, background: '#f59e0b', borderRadius: '0 3px 3px 0' }} />}
          </button>
        ))}
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: '90px' }}>

        {/* Header */}
        <header style={S.header} className="px-4 md:px-6">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="text-[10px] md:text-sm font-black tracking-widest uppercase">
              Nexus <span className="text-indigo-500">Justice</span> <span className="hidden md:inline text-[10px] text-slate-500 ml-2">v3.1 Hybrid</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 md:gap-8">
            <div className={`px-2 md:px-3 py-1 rounded-full flex items-center gap-1 md:gap-2 text-[8px] md:text-[10px] font-bold uppercase tracking-widest ${
              isOffline ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {isOffline ? <WifiOff size={10} /> : <Wifi size={10} />}
              <span className="hidden md:inline">{isOffline ? 'Local Mode' : 'Cloud Active'}</span>
              <span className="md:hidden">{isOffline ? 'Local' : 'Cloud'}</span>
            </div>
            <div className="hidden md:block" style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
            <div className="px-2 md:px-3 py-1 bg-white/5 rounded-full flex items-center gap-3 md:gap-4">
              <button onClick={refreshAiStatus} title="Refresh AI Status" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={10} />
              </button>
              
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)' }} />

              {/* Gemini Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatus.geminiReady ? '#10b981' : '#f43f5e', display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontWeight: 900, color: aiStatus.geminiReady ? '#10b981' : '#f43f5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Gemini 3: {aiStatus.geminiReady ? 'Active' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Tab bar (Upside Menus) */}
        <div style={{ background: '#070b14', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'relative', width: '100%' }}>
          <div className="tab-scroll" style={{ width: '100%', display: 'flex', gap: 0, overflowX: 'auto', padding: '0 4px', minWidth: 0 }}>
            {sideNav.map(item => (
              <button key={item.id} onClick={() => setView(item.id)}
                style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: view === item.id ? '2px solid #6366f1' : '2px solid transparent', color: view === item.id ? '#6366f1' : '#475569', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .2s', flexShrink: 0 }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* NO INSTALL BANNER */}

        {/* NO INSTALL PROGRESS OVERLAY */}

        {/* Content */}
        <main style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#020617' }}>
          
          {/* Incoming Call Overlay */}
          <AnimatePresence>
            {incomingCall && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} style={{ position: 'absolute', top: 24, right: 24, zIndex: 300, width: 320, background: '#0f172a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 20, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-500 animate-pulse">
                    <Volume2 size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{incomingCall.clientName}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>Incoming Call...</div>
                  </div>
                </div>
                {isAnswering ? (
                  <div style={{ background: 'rgba(16,185,129,.1)', borderRadius: 12, padding: 12, border: '1px solid rgba(16,185,129,.2)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>AI Answering...</span>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>"Hello, I am the AI Assistant..."</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => handleAutoAnswer(incomingCall)} style={{ flex: 1, padding: '10px 0', background: '#10b981', border: 'none', borderRadius: 12, color: '#fff', fontSize: 11, fontWeight: 900 }}>Answer</button>
                    <button onClick={() => setIncomingCall(null)} style={{ flex: 1, padding: '10px 0', background: '#ef4444', border: 'none', borderRadius: 12, color: '#fff', fontSize: 11, fontWeight: 900 }}>Decline</button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            
            {/* COMMAND */}
            {view === 'command' && (
              <motion.div key="command" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row h-full gap-6 p-4 md:p-6 overflow-y-auto md:overflow-hidden">
                <div className="w-full md:w-80 flex flex-col gap-4 flex-shrink-0">
                  <div style={S.card} className="p-6 md:p-7">
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32, marginBottom: 16, opacity: 0.8 }}>
                      {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.7, 0.5, 0.9, 0.6, 0.8].map((h, i) => (
                        <div key={i} style={{ 
                          flex: 1, 
                          borderRadius: 1, 
                          background: '#f59e0b', 
                          height: `${h * 100}%`, 
                          animation: `waveBar ${0.5 + (i % 3) * 0.2}s ease-in-out ${i * 0.05}s infinite alternate` 
                        }} />
                      ))}
                    </div>
                    <div style={{ color: '#6366f1', fontSize: 9, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Gemini Orchestrator</div>
                    <h3 style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', marginBottom: 16 }}>Command<span style={{ color: '#475569' }}>Center</span></h3>
                    
                    {/* Voice Node Controls */}
                    <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,.05)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>Live Node</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: isLiveMode ? '#10b981' : '#475569', boxShadow: isLiveMode ? '0 0 10px #10b981' : 'none' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => isLiveMode ? stopLiveSession() : startLiveSession()} style={{ flex: 1, padding: '8px 0', background: isLiveMode ? '#ef4444' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 10, fontWeight: 900 }}>
                          {isLiveMode ? 'Stop Live' : (autoStartLive ? 'Always On (Waiting...)' : 'Start Live')}
                        </button>
                      </div>
                      
                      {isLiveMode && (
                        <div style={{ position: 'relative', width: '100%', height: 120, borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 12 }}>
                          <video ref={liveVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <canvas ref={liveCanvasRef} style={{ display: 'none' }} />
                          <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,.5)', padding: '2px 6px', borderRadius: 4, fontSize: 8, color: '#fff', fontWeight: 900 }}>LIVE VISION</div>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>Voice Node</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setVoiceAiOn(!voiceAiOn)} style={{ flex: 1, padding: '8px 0', background: voiceAiOn ? '#ef4444' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 10, fontWeight: 900 }}>{voiceAiOn ? 'Stop' : 'Start'}</button>
                      </div>
                      
                      {/* Auto Answer Toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>AI Auto-Answer</span>
                          <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>Install app for best results</div>
                        </div>
                        <button onClick={async () => {
                          if (!autoAnswerEnabled) {
                            // Proactively request permissions to avoid Android blocks
                            try {
                              await navigator.mediaDevices.getUserMedia({ audio: true });
                            } catch (e) {
                              console.log("Permission denied or blocked", e);
                            }
                          }
                          setAutoAnswerEnabled(!autoAnswerEnabled);
                        }} style={{ width: 36, height: 20, borderRadius: 10, background: autoAnswerEnabled ? '#10b981' : '#1e293b', position: 'relative', border: 'none', cursor: 'pointer', transition: 'all .2s' }}>
                          <div style={{ position: 'absolute', top: 2, left: autoAnswerEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'all .2s' }} />
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: 9, color: '#334155', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase' }}>System: {aiStatus.builtIn ? 'Local Brain' : 'Cloud Brain'}</div>
                  </div>

                  {/* Quick Action Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button onClick={simulateIncomingCall} style={{ background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 16, padding: 14, textAlign: 'left', transition: 'all .2s' }}>
                      <Bell size={18} className="text-amber-500 mb-2" />
                      <div style={{ fontSize: 12, fontWeight: 900 }}>Simulate Call</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>Test AI Auto-Receptionist</div>
                    </button>
                    <button onClick={() => setView('consult')} style={{ background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.1)', borderRadius: 16, padding: 14, textAlign: 'left', transition: 'all .2s' }}>
                      <MessageSquare size={18} className="text-indigo-500 mb-2" />
                      <div style={{ fontSize: 12, fontWeight: 900 }}>Legal Consultant</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>Strategy & Section Analysis</div>
                    </button>
                    <button onClick={() => setView('writing-desk')} style={{ background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.1)', borderRadius: 16, padding: 14, textAlign: 'left', transition: 'all .2s' }}>
                      <Edit3 size={18} className="text-emerald-500 mb-2" />
                      <div style={{ fontSize: 12, fontWeight: 900 }}>Writing Desk</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>Drafting & AI Review</div>
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
                  <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                      <button onClick={() => setCallViewTab('log')} style={{ flex: 1, padding: '14px 0', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: callViewTab === 'log' ? '#f59e0b' : '#475569', borderBottom: callViewTab === 'log' ? '2px solid #f59e0b' : '2px solid transparent', background: 'none', cursor: 'pointer' }}>Call Logs</button>
                      <button onClick={() => setCallViewTab('transcript')} disabled={!selectedCall} style={{ flex: 1, padding: '14px 0', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: callViewTab === 'transcript' ? '#f59e0b' : '#475569', borderBottom: callViewTab === 'transcript' ? '2px solid #f59e0b' : '2px solid transparent', background: 'none', cursor: 'pointer', opacity: selectedCall ? 1 : 0.3 }}>Transcript</button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                      {callViewTab === 'log' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {SIMULATED_CALLS.map(call => (
                            <div key={call.id} onClick={() => { setSelectedCall(call); setCallViewTab('transcript'); }} style={{ background: selectedCall?.id === call.id ? 'rgba(245,158,11,.05)' : 'rgba(255,255,255,.02)', border: `1px solid ${selectedCall?.id === call.id ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.05)'}`, borderRadius: 16, padding: 16, cursor: 'pointer', transition: 'all .2s' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                                    <Users size={16} />
                                  </div>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{call.clientName}</div>
                                    <div style={{ fontSize: 10, color: '#475569' }}>{call.phone}</div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{call.timestamp}</div>
                                  <div style={{ fontSize: 9, color: '#475569' }}>Duration: {call.duration}</div>
                                </div>
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', borderTop: '1px solid rgba(255,255,255,.03)', paddingTop: 8 }}>
                                {call.summary}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <div>
                              <h4 style={{ fontSize: 14, fontWeight: 900 }}>{selectedCall.clientName}</h4>
                              <p style={{ fontSize: 10, color: '#475569' }}>{selectedCall.timestamp} · {selectedCall.duration}</p>
                            </div>
                            <button 
                              onClick={() => {
                                const context = `I am an advocate. I just had a call with my client ${selectedCall.clientName}. Here is the transcript:\n\n${selectedCall.transcript.map((t: any) => `${t.role.toUpperCase()}: ${t.text}`).join('\n')}\n\nPlease analyze this call, identify the relevant laws involved (especially Indian laws like Property Law, Railways Act, etc.), and guide me on how to consult this client and what steps to take next.`;
                                setView('consult');
                                sendConsult(context);
                              }}
                              style={{ padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: 10, color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                              <RotateCcw size={14} /> Consult AI about this Call
                            </button>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(0,0,0,.2)', borderRadius: 16, padding: 16 }}>
                            {selectedCall.transcript.map((line: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 900, color: line.role === 'client' ? '#f59e0b' : '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{line.role}</span>
                                <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>{line.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Call Slider (Slide Bar) */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10, marginLeft: 4 }}>Recent Call Stream</div>
                    <div className="tab-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
                      {SIMULATED_CALLS.map(call => (
                        <div key={call.id} onClick={() => { setSelectedCall(call); setCallViewTab('transcript'); }} style={{ minWidth: 200, background: selectedCall?.id === call.id ? 'rgba(245,158,11,.1)' : 'rgba(255,255,255,.03)', border: `1px solid ${selectedCall?.id === call.id ? 'rgba(245,158,11,.3)' : 'rgba(255,255,255,.08)'}`, borderRadius: 14, padding: 12, cursor: 'pointer', transition: 'all .2s' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, marginBottom: 2, color: selectedCall?.id === call.id ? '#f59e0b' : '#e2e8f0' }}>{call.clientName}</div>
                          <div style={{ fontSize: 9, color: '#475569' }}>{call.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* CONFIG */}
            {view === 'config' && (
              <motion.div key="config" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
                <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', marginBottom: 24 }}>System Configuration</h2>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20 }}>
                  <div style={S.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900 }}>User Profile</h3>
                        <p style={{ fontSize: 11, color: '#475569' }}>{user?.email || 'Not logged in'}</p>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {user?.photoURL ? (
                          <img src={user.photoURL} alt="Profile" style={{ width: 48, height: 48, borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' }} referrerPolicy="no-referrer" />
                        ) : (
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users size={24} className="text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 900, margin: 0 }}>{user?.displayName || 'Advocate'}</p>
                          <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>Verified Advocate Account</p>
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleLogout}
                        style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#ef4444', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <RotateCcw size={16} />
                        Logout from Nexus Justice
                      </button>

                      <button 
                        onClick={() => {
                          localStorage.clear();
                          window.location.reload();
                        }}
                        style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#64748b', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                      >
                        <RefreshCw size={14} />
                        Reset App & Onboarding
                      </button>
                    </div>
                  </div>

                  <div style={S.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900 }}>AI Orchestrator</h3>
                        <p style={{ fontSize: 11, color: '#475569' }}>Gemini 3 Flash (Sole AI Engine)</p>
                      </div>
                    </div>
                    
                    <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,.05)' }}>
                      <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                        Nexus Justice uses Gemini 3 Flash as the sole AI engine for all tasks including voice interactions, client calls, legal research, drafting, and translation. 
                        It provides high-performance, low-latency legal assistance with built-in Google Search capabilities.
                      </p>
                    </div>
                  </div>

                  <div style={S.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <Shield size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900 }}>Privacy & Security</h3>
                        <p style={{ fontSize: 11, color: '#475569' }}>Data handling preferences</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>Local Database Encryption</span>
                        <div style={{ width: 32, height: 18, borderRadius: 9, background: '#10b981', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12 }}>Cloud Sync (Google Drive)</span>
                        <div 
                          onClick={() => setCloudSync(!cloudSync)}
                          style={{ width: 32, height: 18, borderRadius: 9, background: cloudSync ? '#6366f1' : '#1e293b', position: 'relative', cursor: 'pointer', transition: 'all 0.3s' }}
                        >
                          <div style={{ position: 'absolute', top: 2, left: cloudSync ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'all 0.3s' }} />
                        </div>
                      </div>
                      <button 
                        onClick={restoreFromCloud}
                        style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', color: '#6366f1', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                      >
                        <Download size={14} />
                        Restore from Google Drive
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FEED */}
            {/* ARCHIVE */}
            {view === 'feed' && (
              <motion.div key="archive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', margin: 0 }}>Archive</h2>
                  <div style={{ display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 12, padding: 4 }}>
                    <button onClick={() => setArchiveTab('clients')} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, background: archiveTab === 'clients' ? '#6366f1' : 'transparent', color: archiveTab === 'clients' ? '#fff' : '#64748b' }}>CLIENTS</button>
                    <button onClick={() => setArchiveTab('drafts')} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, background: archiveTab === 'drafts' ? '#6366f1' : 'transparent', color: archiveTab === 'drafts' ? '#fff' : '#64748b' }}>DRAFTS</button>
                    <button onClick={() => setArchiveTab('scans')} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, background: archiveTab === 'scans' ? '#6366f1' : 'transparent', color: archiveTab === 'scans' ? '#fff' : '#64748b' }}>SCANS</button>
                    <button onClick={() => setArchiveTab('uploads')} style={{ padding: '8px 16px', borderRadius: 10, fontSize: 11, fontWeight: 900, background: archiveTab === 'uploads' ? '#6366f1' : 'transparent', color: archiveTab === 'uploads' ? '#fff' : '#64748b' }}>UPLOADS</button>
                  </div>
                </div>

                {archiveTab === 'clients' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {archivedClients.length === 0 ? (
                      <div style={{ padding: 60, textAlign: 'center', color: '#475569', fontSize: 14 }}>No archived clients.</div>
                    ) : (
                      archivedClients.map(c => (
                        <div key={c.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 900 }}>{c.name[0]}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: '#475569' }}>{c.case_number} · {c.court}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => restoreClient(c.id)} style={{ padding: '8px 16px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>RESTORE</button>
                            <button onClick={() => deleteClientPermanently(c.id)} style={{ padding: '8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {archiveTab === 'drafts' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {archivedDrafts.map(d => (
                      <div key={d.id} style={{ ...S.card, padding: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{d.title}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>{d.timestamp}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => restoreKbItem('draft', d.id)} style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900 }}>RESTORE</button>
                          <button onClick={() => deleteKbItem('draft', d.id, true)} style={{ padding: '8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {archiveTab === 'scans' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {archivedScans.map(s => (
                      <div key={s.id} style={{ ...S.card, padding: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{s.title}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>{s.timestamp}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => restoreKbItem('scan', s.id)} style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900 }}>RESTORE</button>
                          <button onClick={() => deleteKbItem('scan', s.id, true)} style={{ padding: '8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {archiveTab === 'uploads' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                    {archivedUploads.map(u => (
                      <div key={u.id} style={{ ...S.card, padding: 20 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginBottom: 16 }}>{u.size} · {u.timestamp}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => restoreKbItem('upload', u.id)} style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 10, color: '#10b981', fontSize: 10, fontWeight: 900 }}>RESTORE</button>
                          <button onClick={() => deleteKbItem('upload', u.id, true)} style={{ padding: '8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 10, color: '#ef4444' }}><Trash2 size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* CONSULT */}
            {view === 'consult' && (
              <motion.div key="consult" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col p-4 md:p-6 gap-3 overflow-hidden">
                <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                    {chatHistory.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div 
                          className="max-w-[90%] md:max-w-[80%] p-[13px_17px] rounded-[20px] relative text-[13px] leading-[1.7]"
                          style={{ 
                            background: msg.role === 'user' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)', 
                            border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}` 
                          }}
                        >
                          <div className="markdown-body">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 6, gap: 20 }}>
                            <span style={{ fontSize: 9, color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {msg.role === 'user' ? 'You' : (msg.engine || 'Nexus AI')}
                            </span>
                            <div style={{ display: 'flex', gap: 10, opacity: 0.5 }}>
                              {msg.role === 'assistant' && (
                                <>
                                  <button onClick={() => speakResponse(msg.content)} title="Read aloud" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                                    <Volume2 size={12} />
                                  </button>
                                  <button onClick={() => copyToClipboard(msg.content)} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                                    <Copy size={12} />
                                  </button>
                                  <button onClick={() => downloadResponse(msg.content)} title="Download" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                                    <Download size={12} />
                                  </button>
                                </>
                              )}
                              <button onClick={() => deleteMessage(i)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {voiceAiTranscript && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: 20, background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.1)', fontSize: 13, lineHeight: 1.7, opacity: 0.6 }}>
                          <span className="italic">"{voiceAiTranscript}"</span>
                        </div>
                      </div>
                    )}
                    {voiceAiListening && !voiceAiTranscript && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: 20, background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.1)', fontSize: 13, lineHeight: 1.7, opacity: 0.4 }}>
                          <span className="italic">Listening...</span>
                        </div>
                      </div>
                    )}
                    {(consoleLoading || voiceAiThinking) && (
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" />
                        </div>
                        <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 900, textTransform: 'uppercase' }}>
                          {voiceAiStatus || 'Thinking...'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input value={consoleInput} onChange={e => setConsoleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (fixAudio(), sendConsult())} placeholder="Ask anything legal..." style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '13px 18px' }} />
                    {consoleLoading ? (
                      <button onClick={() => { if(abortControllerRef.current) abortControllerRef.current.abort(); setConsoleLoading(false); }} style={{ padding: '13px 22px', background: '#ef4444', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Square size={14} fill="currentColor" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => { fixAudio(); sendConsult(); }} style={{ padding: '13px 22px', background: '#6366f1', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900 }}>Send</button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* CLIENTS */}
            {view === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
                  <h2 className="text-2xl md:text-3xl font-black italic">Client Registry</h2>
                  <button onClick={() => setAddingClient(true)} style={{ padding: '11px 22px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 14, color: '#f59e0b', fontWeight: 900 }}>+ Add Client</button>
                </div>
                <div style={S.card} className="overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        {['SL No.', 'Client Info', 'Case & Court', 'Opp. Advocate', 'Next Posting', 'Actions'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', fontSize: 10, color: '#475569', textTransform: 'uppercase' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c, idx) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: 12, fontSize: 12, color: '#64748b' }}>{idx + 1}</td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: '#fff' }}>{c.name}</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{c.phone}</span>
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <span className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[10px] w-fit font-bold">{c.case_number}</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{c.court}</span>
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 12, color: '#cbd5e1' }}>{c.opp_advocate_name || 'N/A'}</span>
                              <span style={{ fontSize: 11, color: '#64748b' }}>{c.opp_advocate_phone}</span>
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 700 }}>{c.next_date}</span>
                              <span style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>{c.purpose}</span>
                            </div>
                          </td>
                          <td style={{ padding: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ padding: '4px 8px', background: 'rgba(255,255,255,.05)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <FileText size={12} className="text-slate-400" />
                                <span style={{ fontSize: 11, color: '#fff' }}>{c.documents?.length || 0}</span>
                              </div>
                              {c.documents?.length > 0 && (
                                <button 
                                  onClick={() => setViewingDocsClient(c)}
                                  title="View Documents" 
                                  style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 4 }}
                                >
                                  <ExternalLink size={14} />
                                </button>
                              )}
                              <button 
                                onClick={() => archiveClient(c.id)}
                                title="Archive Client" 
                                style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 4 }}
                              >
                                <Archive size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* View Documents Modal */}
                <AnimatePresence>
                  {viewingDocsClient && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ background: '#0a0f1d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                          <div>
                            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>Client Documents</h3>
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Viewing documents for {viewingDocsClient.name}</p>
                          </div>
                          <button onClick={() => setViewingDocsClient(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                        </div>

                        {viewingDocsClient.documents && viewingDocsClient.documents.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
                            {viewingDocsClient.documents.map((doc: any) => (
                              <motion.div 
                                key={doc.id}
                                whileHover={{ y: -5 }}
                                style={{ 
                                  background: 'rgba(255,255,255,0.03)', 
                                  border: '1px solid rgba(255,255,255,0.05)', 
                                  borderRadius: 16, 
                                  padding: 16,
                                  position: 'relative',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12
                                }}
                              >
                                <div style={{ width: '100%', height: 120, background: 'rgba(0,0,0,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                  {doc.type.startsWith('image/') ? (
                                    <img src={doc.data} alt={doc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                                  ) : (
                                    <FileText size={48} color="#6366f1" />
                                  )}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', wordBreak: 'break-all' }}>{doc.name}</p>
                                  <p style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{new Date(doc.timestamp).toLocaleDateString()}</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button 
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = doc.data;
                                      link.download = doc.name;
                                      link.click();
                                    }}
                                    style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, color: '#6366f1', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    Download
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteDocument(viewingDocsClient.id, doc.id)}
                                    style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#ef4444', cursor: 'pointer' }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <FileText size={48} color="#1e293b" style={{ margin: '0 auto 16px' }} />
                            <p style={{ color: '#64748b' }}>No documents found for this client.</p>
                          </div>
                        )}
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Add Client Modal */}
                <AnimatePresence>
                  {addingClient && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} style={{ background: '#0a0f1d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: 32, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                          <h3 style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>New Client Entry</h3>
                          <button onClick={() => setAddingClient(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Full Name of Client</label>
                              <input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. Rahul Sharma" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Phone Number</label>
                              <input value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="+91 00000 00000" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Case Number</label>
                              <input value={newClient.case_number} onChange={e => setNewClient({...newClient, case_number: e.target.value})} placeholder="e.g. OS 123/2026" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Name of Court</label>
                              <input value={newClient.court} onChange={e => setNewClient({...newClient, court: e.target.value})} placeholder="e.g. District Court" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Opposite Advocate's Name</label>
                              <input value={newClient.opp_advocate_name} onChange={e => setNewClient({...newClient, opp_advocate_name: e.target.value})} placeholder="e.g. Adv. Vikram Singh" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Opposite Advocate's Phone</label>
                              <input value={newClient.opp_advocate_phone} onChange={e => setNewClient({...newClient, opp_advocate_phone: e.target.value})} placeholder="+91 00000 00000" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Next Posting Date</label>
                              <input type="date" value={newClient.next_date} onChange={e => setNewClient({...newClient, next_date: e.target.value})} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Purpose / Remarks</label>
                              <input value={newClient.purpose} onChange={e => setNewClient({...newClient, purpose: e.target.value})} placeholder="e.g. Evidence" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, color: '#fff', fontSize: 13 }} />
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <label style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Document Upload</label>
                            <div style={{ position: 'relative' }}>
                              <input type="file" onChange={handleClientDocUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }} />
                              <div style={{ padding: '16px', background: 'rgba(99,102,241,.05)', border: '1px dashed rgba(99,102,241,.2)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#6366f1' }}>
                                <FileUp size={16} />
                                <span style={{ fontSize: 12, fontWeight: 700 }}>Click to upload client documents</span>
                              </div>
                            </div>
                            {newClient.documents.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                {newClient.documents.map((d, i) => (
                                  <div key={i} style={{ padding: '6px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <FileText size={12} className="text-indigo-400" />
                                    <span>{d.name}</span>
                                    <button onClick={() => setNewClient(prev => ({ ...prev, documents: prev.documents.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <motion.button 
                            whileHover={{ scale: isRegistering ? 1 : 1.02, backgroundColor: isRegistering ? '#6366f1' : '#4f46e5' }}
                            whileTap={{ scale: isRegistering ? 1 : 0.98 }}
                            onClick={handleAddClient} 
                            disabled={isRegistering}
                            style={{ 
                              marginTop: 12, 
                              marginBottom: 20, 
                              padding: 16, 
                              background: isRegistering ? '#4338ca' : '#6366f1', 
                              border: 'none', 
                              borderRadius: 14, 
                              color: '#fff', 
                              fontWeight: 900, 
                              fontSize: 14, 
                              cursor: isRegistering ? 'not-allowed' : 'pointer', 
                              boxShadow: '0 10px 20px -5px rgba(99,102,241,0.4)',
                              zIndex: 10,
                              position: 'relative',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 10
                            }}
                          >
                            {isRegistering ? (
                              <>
                                <motion.div 
                                  animate={{ rotate: 360 }} 
                                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                  style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }}
                                />
                                Entering Data...
                              </>
                            ) : 'Register Client'}
                          </motion.button>

                          <AnimatePresence>
                            {showSuccessOverlay && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'rgba(0,0,0,0.8)',
                                  backdropFilter: 'blur(8px)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 24,
                                  zIndex: 100,
                                  textAlign: 'center',
                                  padding: 20
                                }}
                              >
                                <motion.div 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', damping: 12 }}
                                  style={{ width: 64, height: 64, background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
                                >
                                  <Check size={32} color="#fff" />
                                </motion.div>
                                <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 900, marginBottom: 8 }}>Client details Entered</h3>
                                <p style={{ color: '#94a3b8', fontSize: 14 }}>The client has been successfully added to the registry.</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* KNOWLEDGE BASE */}
            {view === 'knowledge-base' && (
              <motion.div key="kb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', margin: 0 }}>Law Knowledge Base</h2>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <label style={{ 
                      padding: '10px 20px', 
                      background: '#6366f1', 
                      borderRadius: 12, 
                      color: '#fff', 
                      fontSize: 12, 
                      fontWeight: 900, 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 10px 20px -5px rgba(99,102,241,0.4)'
                    }}>
                      <Upload size={16} />
                      UPLOAD DOCUMENT
                      <input type="file" accept=".zip,application/zip,application/x-zip-compressed,.pdf,.doc,.docx,.txt" hidden onChange={handleKbUpload} />
                    </label>
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,.05)', borderRadius: 10, padding: 4 }}>
                      <button onClick={() => setKbFilter('all')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: kbFilter === 'all' ? '#6366f1' : 'transparent', color: kbFilter === 'all' ? '#fff' : '#64748b' }}>ALL</button>
                      <button onClick={() => setKbFilter('acts')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: kbFilter === 'acts' ? '#6366f1' : 'transparent', color: kbFilter === 'acts' ? '#fff' : '#64748b' }}>ACTS</button>
                      <button onClick={() => setKbFilter('drafts')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: kbFilter === 'drafts' ? '#6366f1' : 'transparent', color: kbFilter === 'drafts' ? '#fff' : '#64748b' }}>MY DRAFTS</button>
                      <button onClick={() => setKbFilter('scans')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: kbFilter === 'scans' ? '#6366f1' : 'transparent', color: kbFilter === 'scans' ? '#fff' : '#64748b' }}>SCANS</button>
                      <button onClick={() => setKbFilter('uploads')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 10, fontWeight: 900, background: kbFilter === 'uploads' ? '#6366f1' : 'transparent', color: kbFilter === 'uploads' ? '#fff' : '#64748b' }}>UPLOADS</button>
                    </div>
                  </div>
                </div>

                {kbFilter !== 'drafts' && kbFilter !== 'scans' && kbFilter !== 'uploads' && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Legal Acts & References</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                      {kbDocs.filter(d => kbFilter === 'all' || kbFilter === 'acts' || d.category === kbFilter).map(doc => (
                        <div key={doc.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
                          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{doc.name}</div>
                            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{doc.size} · {doc.pages} pages</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {(kbFilter === 'all' || kbFilter === 'uploads') && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Uploaded Documents</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                      {uploadedDocs.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,.05)' }}>
                          <Upload size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                          <div style={{ fontSize: 13, color: '#475569' }}>No uploaded documents yet.</div>
                        </div>
                      ) : (
                        uploadedDocs.map(doc => (
                          <div key={doc.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: doc.name.toLowerCase().endsWith('.zip') ? 'rgba(245,158,11,.1)' : 'rgba(99,102,241,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: doc.name.toLowerCase().endsWith('.zip') ? '#f59e0b' : '#6366f1' }}>
                                {doc.name.toLowerCase().endsWith('.zip') ? <Archive size={16} /> : <FileText size={16} />}
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button 
                                  onClick={() => deleteKbItem('upload', doc.id)}
                                  style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 4 }}
                                  title="Archive Document"
                                >
                                  <Archive size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteKbItem('upload', doc.id, true)}
                                  style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 4 }}
                                  title="Delete Permanently"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6, wordBreak: 'break-all' }}>{doc.name}</div>
                            <div style={{ fontSize: 10, color: '#475569' }}>{doc.size} · {new Date(doc.timestamp).toLocaleDateString()}</div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                              <button 
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = doc.data;
                                  link.download = doc.name;
                                  link.click();
                                }}
                                style={{ flex: 1, padding: '8px', background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: '#cbd5e1', fontSize: 10, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                              >
                                <Download size={14} /> DOWNLOAD
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {(kbFilter === 'all' || kbFilter === 'drafts') && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Saved Drafts & Petitions</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                      {savedDrafts.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,.05)' }}>
                          <FileText size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                          <div style={{ fontSize: 13, color: '#475569' }}>No drafts saved yet. Use the Writing Desk to create one.</div>
                        </div>
                      ) : (
                        savedDrafts.map(draft => (
                          <div key={draft.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <Zap size={16} />
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button 
                                  onClick={() => deleteKbItem('draft', draft.id)}
                                  style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 4 }}
                                  title="Archive Draft"
                                >
                                  <Archive size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteKbItem('draft', draft.id, true)}
                                  style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 4 }}
                                  title="Delete Permanently"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{draft.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, height: 50, overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft.content.slice(0, 150)}...</div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                              <button 
                                onClick={() => {
                                  setDraftPages([draft.content]);
                                  setCaseFacts(draft.case_facts || "");
                                  setView('writing-desk');
                                }}
                                style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,.1)', border: 'none', borderRadius: 8, color: '#6366f1', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
                              >
                                Open in Desk
                              </button>
                              <button 
                                onClick={() => downloadAsPDF(draft.content, draft.title)}
                                style={{ padding: '8px', background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: '#cbd5e1', cursor: 'pointer' }}
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {(kbFilter === 'all' || kbFilter === 'scans') && (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>Scanned Documents & Analysis</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {scannedDocs.length === 0 ? (
                        <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', background: 'rgba(255,255,255,.02)', borderRadius: 20, border: '1px dashed rgba(255,255,255,.05)' }}>
                          <Camera size={32} style={{ color: '#1e293b', margin: '0 auto 12px' }} />
                          <div style={{ fontSize: 13, color: '#475569' }}>No scans saved yet. Use the Reading Room to scan one.</div>
                        </div>
                      ) : (
                        scannedDocs.map(scan => (
                          <div key={scan.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <Camera size={16} />
                              </div>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button 
                                  onClick={() => deleteKbItem('scan', scan.id)}
                                  style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: 4 }}
                                  title="Archive Scan"
                                >
                                  <Archive size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteKbItem('scan', scan.id, true)}
                                  style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 4 }}
                                  title="Delete Permanently"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{scan.title}</div>
                            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5, height: 50, overflow: 'hidden', textOverflow: 'ellipsis' }}>{scan.content.slice(0, 150)}...</div>
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                              <button 
                                onClick={() => {
                                  setScannedText(scan.content);
                                  setView('reading-room');
                                }}
                                style={{ flex: 1, padding: '8px', background: 'rgba(16,185,129,.1)', border: 'none', borderRadius: 8, color: '#10b981', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}
                              >
                                View in Room
                              </button>
                              <button 
                                onClick={() => downloadAsPDF(scan.content, scan.title)}
                                style={{ padding: '8px', background: 'rgba(255,255,255,.05)', border: 'none', borderRadius: 8, color: '#cbd5e1', cursor: 'pointer' }}
                              >
                                <Download size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* TEMP INSTRUCTIONS */}
            {view === 'temp-instructions' && (
              <motion.div key="instr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', padding: 24, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', margin: 0 }}>Temporary Instructions</h2>
                </div>

                <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 20, padding: 20, border: '1px solid rgba(255,255,255,.05)', marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Add New Instruction</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      value={newInstruction}
                      onChange={(e) => setNewInstruction(e.target.value)}
                      placeholder="e.g. Tell clients I'm in court until 2 PM..."
                      style={{ flex: 1, background: '#0a0f1d', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 13 }}
                    />
                    <button 
                      onClick={handleAddInstruction}
                      style={{ padding: '0 20px', background: '#6366f1', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
                    >
                      ADD
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tempInstructions.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
                      No active instructions.
                    </div>
                  ) : (
                    tempInstructions.map(instr => (
                      <div key={instr.id} style={{ ...S.card, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ margin: 0, fontSize: 13, flex: 1 }}>{instr.text}</p>
                        <button 
                          onClick={() => deleteInstruction(instr.id)}
                          style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', padding: 8 }}
                          title="Delete Instruction"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* NOTIFICATIONS */}
            {view === 'notifications' && (
              <motion.div key="notif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', padding: 24 }}>
                <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic', marginBottom: 20 }}>Notifications</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ ...S.card, padding: 16 }}>
                      <p style={{ margin: 0, fontSize: 13 }}>{n.message}</p>
                      <p style={{ margin: '4px 0 0', fontSize: 10, color: '#475569' }}>{n.date}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* SUPPORT */}
            {view === 'support' && (
              <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, position: 'relative' }}>
                <button 
                  onClick={() => setView('dashboard')}
                  style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={20} />
                </button>
                <h2 style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', marginBottom: 20 }}>Help Desk</h2>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {supportMsgs.map(msg => (
                    <div key={msg.id} style={{ 
                      maxWidth: '80%', 
                      padding: 12, 
                      borderRadius: 16, 
                      background: msg.role === 'ai' ? 'rgba(255,255,255,.03)' : 'rgba(99,102,241,.1)',
                      alignSelf: msg.role === 'ai' ? 'flex-start' : 'flex-end',
                      border: `1px solid ${msg.role === 'ai' ? 'rgba(255,255,255,.05)' : 'rgba(99,102,241,.2)'}`
                    }}>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{msg.text}</p>
                    </div>
                  ))}
                  {supportLoading && (
                    <div style={{ alignSelf: 'flex-start', padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 16, display: 'flex', gap: 4 }}>
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, background: 'rgba(255,255,255,.03)', padding: 8, borderRadius: 20, border: '1px solid rgba(255,255,255,.05)' }}>
                  <input 
                    type="text" 
                    value={supportInput}
                    onChange={(e) => setSupportInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendSupportMessage()}
                    placeholder="Describe your issue or ask a question..."
                    style={{ flex: 1, background: 'none', border: 'none', padding: '10px 16px', fontSize: 13 }}
                  />
                  <button 
                    onClick={sendSupportMessage}
                    disabled={!supportInput.trim() || supportLoading}
                    style={{ 
                      width: 40, 
                      height: 40, 
                      borderRadius: 14, 
                      background: supportInput.trim() ? '#6366f1' : 'rgba(255,255,255,.05)', 
                      color: '#fff', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      cursor: supportInput.trim() ? 'pointer' : 'default',
                      transition: 'all .2s'
                    }}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* READING ROOM */}
            {view === 'reading-room' && (
              <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#070b14' }}>
                <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-5 overflow-y-auto">
                  <div className="w-full md:w-[420px] flex-shrink-0 flex flex-col gap-3">
                    <div 
                      className="min-h-[250px] md:min-h-[300px] overflow-hidden relative"
                      style={{ background: '#0a0f1d', borderRadius: 22, border: '1px solid rgba(255,255,255,.07)' }}
                    >
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanPhase === 'live' ? 'block' : 'none' }} />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      {scanPhase === 'idle' && <div className="absolute inset-0 flex items-center justify-center text-slate-500">Camera is off</div>}
                      {scanPhase === 'live' && (
                        <>
                          <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase animate-pulse">Live</div>
                          <button 
                            onClick={() => { 
                              setScanPhase('idle'); 
                              setCamOn(false);
                              if (videoRef.current?.srcObject) {
                                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                                videoRef.current.srcObject = null;
                              }
                            }} 
                            style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {scanPhase === 'idle' ? (
                        <button onClick={startScan} style={{ flex: 1, padding: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, color: '#10b981', fontWeight: 900 }}>Start Camera</button>
                      ) : (
                        <>
                          <button onClick={captureScan} style={{ flex: 2, padding: 12, background: '#10b981', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900 }}>Capture & Read</button>
                          <button 
                            onClick={() => { 
                              setScanPhase('idle'); 
                              setCamOn(false);
                              if (videoRef.current?.srcObject) {
                                (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
                                videoRef.current.srcObject = null;
                              }
                            }} 
                            style={{ flex: 1, padding: 12, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, color: '#ef4444', fontWeight: 900 }}
                          >
                            Close
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ flex: 1, ...S.card, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 9, color: '#10b981', fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>Extracted Text</div>
                    <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, color: '#94a3b8', lineHeight: 1.8, fontFamily: 'monospace' }}>
                      {scanPhase === 'processing' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <div style={{ width: '100%', maxWidth: 200, height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${scanProgress}%` }}
                              style={{ height: '100%', background: '#10b981' }} 
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i*0.2 }} style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />)}
                          </div>
                          <span style={{ fontSize: 10, color: '#10b981', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {voiceAiStatus || 'Scanning Document...'}
                          </span>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {scannedText || "Capture a document to see text..."}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* DOC CONVERTER */}
            {view === 'doc-converter' && (
              <motion.div key="converter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic' }}>Document Converter & Translator</h2>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <input type="file" onChange={handleConverterFileUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                      <button style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 12, color: '#6366f1', fontSize: 12, fontWeight: 900 }}>
                        <FileUp size={16} /> Upload Document
                      </button>
                    </div>
                    <button onClick={handleConverterCapture} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, color: '#10b981', fontSize: 12, fontWeight: 900 }}>
                      <Camera size={16} /> Capture from Camera
                    </button>
                    <button onClick={deleteConverterDoc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 12, color: '#ef4444', fontSize: 12, fontWeight: 900 }}>
                      <Trash2 size={16} /> Clear All
                    </button>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, overflow: 'hidden' }}>
                  {/* Input Side */}
                  <div style={{ ...S.card, display: 'flex', flexDirection: 'column', padding: 0 }}>
                    <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Original Document Text</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => copyToClipboard(converterInputText)} style={{ padding: 6, color: '#64748b' }}><Copy size={14} /></button>
                        <button onClick={() => downloadAsPDF(converterInputText, 'Original_Doc')} style={{ padding: 6, color: '#64748b' }}><FileText size={14} /></button>
                        <button onClick={() => downloadAsWord(converterInputText, 'Original_Doc')} style={{ padding: 6, color: '#64748b' }}><Download size={14} /></button>
                      </div>
                    </div>
                    <textarea 
                      value={converterInputText}
                      onChange={e => setConverterInputText(e.target.value)}
                      placeholder="Extracted text will appear here..."
                      style={{ flex: 1, background: 'transparent', border: 'none', padding: 20, color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, resize: 'none' }}
                    />
                  </div>

                  {/* Output Side */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Translation Controls */}
                    <div style={{ ...S.card, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                      <Languages size={20} className="text-indigo-500" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Target Language</div>
                        <select 
                          value={converterTargetLang}
                          onChange={e => setConverterTargetLang(e.target.value)}
                          style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#fff', fontSize: 12, padding: '8px' }}
                        >
                          <option value="ml-IN">Malayalam</option>
                          <option value="hi-IN">Hindi</option>
                          <option value="ta-IN">Tamil</option>
                          <option value="te-IN">Telugu</option>
                          <option value="kn-IN">Kannada</option>
                          <option value="gu-IN">Gujarati</option>
                          <option value="mr-IN">Marathi</option>
                          <option value="bn-IN">Bengali</option>
                        </select>
                      </div>
                      <button 
                        onClick={handleTranslateDoc}
                        disabled={isConverting || !converterInputText}
                        style={{ padding: '12px 24px', background: '#6366f1', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', opacity: (isConverting || !converterInputText) ? 0.5 : 1 }}
                      >
                        {isConverting ? 'Translating...' : 'Translate (Gemini)'}
                      </button>
                    </div>

                    {/* Translated Area */}
                    <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
                      <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Translated Document Text</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => copyToClipboard(converterTranslatedText)} style={{ padding: 6, color: '#64748b' }}><Copy size={14} /></button>
                          <button onClick={() => downloadAsPDF(converterTranslatedText, 'Translated_Doc')} style={{ padding: 6, color: '#64748b' }}><FileText size={14} /></button>
                          <button onClick={() => downloadAsWord(converterTranslatedText, 'Translated_Doc')} style={{ padding: 6, color: '#64748b' }}><Download size={14} /></button>
                        </div>
                      </div>
                      <textarea 
                        value={converterTranslatedText}
                        onChange={e => setConverterTranslatedText(e.target.value)}
                        placeholder="Translated text will appear here..."
                        style={{ flex: 1, background: 'transparent', border: 'none', padding: 20, color: '#cbd5e1', fontSize: 13, lineHeight: 1.8, resize: 'none' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* WRITING DESK */}
            {view === 'writing-desk' && (
              <motion.div key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col md:flex-row overflow-hidden bg-[#020617]">
                
                {/* Column 1: Advocate Inputs */}
                <div 
                  className={`flex flex-col bg-[#070b14] transition-all duration-300 border-r border-white/5 ${maximizedColumn === 'inputs' ? 'w-full' : (maximizedColumn === 'none' ? 'w-full md:w-[350px]' : 'w-0 hidden')} ${maximizedColumn === 'none' ? 'max-h-[40vh] md:max-h-none' : 'h-auto'}`}
                >
                  <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Edit3 size={14} className="text-indigo-500" />
                      <h3 style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>Advocate Inputs</h3>
                    </div>
                    <button 
                      onClick={() => setMaximizedColumn(maximizedColumn === 'inputs' ? 'none' : 'inputs')}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      title={maximizedColumn === 'inputs' ? "Minimize" : "Enlarge"}
                    >
                      {maximizedColumn === 'inputs' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                  </div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Facts of the Case */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Facts of the Case</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            onClick={toggleRecordFacts}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, color: isRecordingFacts ? '#ef4444' : '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}
                          >
                            <Mic size={10} className={isRecordingFacts ? 'animate-pulse' : ''} />
                            {isRecordingFacts ? 'Recording...' : 'Voice'}
                          </button>
                        </div>
                      </div>
                      <textarea 
                        value={caseFacts} 
                        onChange={e => setCaseFacts(e.target.value)}
                        placeholder="Describe the client's story/facts. Gemini will guide you if anything is missing..."
                        style={{ width: '100%', height: 250, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 12, fontSize: 12, resize: 'none', lineHeight: 1.6 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => {
                            setNotifications(prev => [{ id: Date.now(), message: "Facts analyzed by Gemini.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
                            getAiGuidance();
                          }}
                          style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, color: '#6366f1', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          <Brain size={12} /> Get AI Guidance
                        </button>
                      </div>
                    </div>

                    {/* Model Upload */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Drafting Model / Template</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                          type="file" 
                          onChange={handleFileUpload}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 2 }}
                        />
                        <div style={{ padding: '12px', background: draftingModel ? 'rgba(16,185,129,.05)' : 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: draftingModel ? '#10b981' : '#475569' }}>
                          <Plus size={14} />
                          <span style={{ fontSize: 11 }}>{draftingModel ? 'Model Uploaded' : 'Upload Template'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Saved Drafts Quick Access */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Saved Drafts</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {savedDrafts.slice(0, 3).map(draft => (
                          <button 
                            key={draft.id}
                            onClick={() => {
                              setDraftPages([draft.content]);
                              setCaseFacts(draft.case_facts || '');
                              setWritingDeskPhase('final');
                            }}
                            style={{ padding: '10px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 10, textAlign: 'left', fontSize: 11, color: '#cbd5e1' }}
                          >
                            <div style={{ fontWeight: 700, marginBottom: 2 }}>{draft.title}</div>
                            <div style={{ fontSize: 9, color: '#475569' }}>{new Date(draft.timestamp).toLocaleDateString()}</div>
                          </button>
                        ))}
                        {savedDrafts.length === 0 && (
                          <div style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', padding: '10px', textAlign: 'center' }}>No saved drafts yet.</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <button 
                      onClick={generateDraft}
                      disabled={deskLoading}
                      style={{ width: '100%', padding: '14px', background: '#f59e0b', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: deskLoading ? 0.5 : 1 }}
                    >
                      {deskLoading ? <RotateCcw size={16} className="spin" /> : <Zap size={16} />}
                      Generate Draft (Gemini)
                    </button>
                  </div>
                </div>

                {/* Column 2: Draft Editor */}
                <div 
                  className={`flex flex-col border-r border-white/5 transition-all duration-300 ${maximizedColumn === 'editor' ? 'w-full' : (maximizedColumn === 'none' ? 'flex-1' : 'w-0 hidden')} ${maximizedColumn === 'none' ? 'min-h-[50vh] md:min-h-0' : 'h-auto'}`}
                >
                  <div style={{ height: 48, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} className="text-indigo-500" />
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Legal Draft Editor</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                      <button 
                        onClick={() => setMaximizedColumn(maximizedColumn === 'editor' ? 'none' : 'editor')}
                        className="hidden md:flex items-center gap-1.5 p-1.5 px-3 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-[10px] font-black"
                        title={maximizedColumn === 'editor' ? "Minimize" : "Enlarge"}
                      >
                        {maximizedColumn === 'editor' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {maximizedColumn === 'editor' ? 'Minimize' : 'Enlarge'}
                      </button>
                      <button onClick={handleDownloadDraft} className="flex items-center gap-1.5 p-1.5 px-3 bg-white/5 border border-white/10 rounded-lg text-slate-300 text-[10px] font-black">
                        <Download size={12} /> Download
                      </button>
                      <button onClick={saveDraftToDb} className="flex items-center gap-1.5 p-1.5 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-[10px] font-black">
                        <Save size={12} /> Save
                      </button>
                      <button onClick={() => setDraftEditMode(!draftEditMode)} className={`p-1.5 px-3 border rounded-lg text-[10px] font-black ${draftEditMode ? 'bg-amber-500 text-black border-amber-500' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>
                        {draftEditMode ? 'Save' : 'Edit'}
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#0d1117] p-6 md:p-10 overflow-y-auto relative">
                    {draftEditMode ? (
                      <textarea 
                        value={draftPages[0]}
                        onChange={e => setDraftPages([e.target.value])}
                        style={{ width: '100%', height: '100%', background: 'transparent', border: 'none', color: '#cbd5e1', fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.8, resize: 'none' }}
                      />
                    ) : (
                      <div className="markdown-body">
                        <ReactMarkdown>{draftPages[0]}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 3: AI Assistant */}
                <div 
                  className={`flex flex-col bg-[#070b14] transition-all duration-300 ${maximizedColumn === 'assistant' ? 'w-full' : (maximizedColumn === 'none' ? 'w-full md:w-[320px]' : 'w-0 hidden')} ${maximizedColumn === 'none' ? 'max-h-[40vh] md:max-h-none' : 'h-auto'}`}
                >
                  <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Zap size={14} className="text-indigo-500" />
                      <h3 style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>AI Assistant</h3>
                    </div>
                    <button 
                      onClick={() => setMaximizedColumn(maximizedColumn === 'assistant' ? 'none' : 'assistant')}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                      title={maximizedColumn === 'assistant' ? "Minimize" : "Enlarge"}
                    >
                      {maximizedColumn === 'assistant' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                  </div>
                  
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Guidance Questions (Gemini) */}
                    {aiQuestions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>Gemini's Guidance</div>
                        {aiQuestions.map((q, i) => (
                          <div key={i} style={{ padding: 12, background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.1)', borderRadius: 12, fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
                            {q}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Suggestions Dropdown */}
                    {showSuggestionsDropdown && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 16, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>AI Suggestions</div>
                          <button onClick={() => { setShowSuggestionsDropdown(false); getRelatedCases(); }} style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, background: 'none', border: 'none', cursor: 'pointer' }}>Done</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {aiSuggestionsList.map((s, i) => (
                            <div key={i} onClick={() => {
                              const newList = [...aiSuggestionsList];
                              newList[i].selected = !newList[i].selected;
                              setAiSuggestionsList(newList);
                            }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: s.selected ? 'rgba(245,158,11,.1)' : 'rgba(255,255,255,.02)', borderRadius: 10, cursor: 'pointer', transition: 'all .2s' }}>
                              <div style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: s.selected ? '#f59e0b' : 'transparent' }}>
                                {s.selected && <Check size={12} color="#000" />}
                              </div>
                              <div style={{ fontSize: 11, color: s.selected ? '#fff' : '#94a3b8' }}>{s.text}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Cases Dropdown */}
                    {showCasesDropdown && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(16,185,129,.05)', border: '1px solid rgba(16,185,129,.1)', borderRadius: 16, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>Related Case Citations</div>
                          <button onClick={() => { setShowCasesDropdown(false); recreateDraft(); }} style={{ fontSize: 9, color: '#10b981', fontWeight: 900, background: 'none', border: 'none', cursor: 'pointer' }}>Recreate Draft</button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {relatedCasesList.map((c, i) => (
                            <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div onClick={() => {
                                const newList = [...relatedCasesList];
                                newList[i].selected = !newList[i].selected;
                                setRelatedCasesList(newList);
                              }} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                <div style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid rgba(16,185,129,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.selected ? '#10b981' : 'transparent' }}>
                                  {c.selected && <Check size={12} color="#000" />}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{c.citation}</div>
                              </div>
                              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>{c.description}</div>
                              
                              {c.selected && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 8 }}>
                                  <input 
                                    placeholder="Where does this fit? (e.g. Paragraph 4)" 
                                    value={c.placement}
                                    onChange={e => {
                                      const newList = [...relatedCasesList];
                                      newList[i].placement = e.target.value;
                                      setRelatedCasesList(newList);
                                    }}
                                    style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#fff' }}
                                  />
                                  <textarea 
                                    placeholder="Reason for inclusion..." 
                                    value={c.reason}
                                    onChange={e => {
                                      const newList = [...relatedCasesList];
                                      newList[i].reason = e.target.value;
                                      setRelatedCasesList(newList);
                                    }}
                                    style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 6, padding: '6px 10px', fontSize: 10, color: '#fff', height: 60, resize: 'none' }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chat History */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>Interaction Log</div>
                      {deskChatHistory.map((msg, i) => (
                        <div key={i} style={{ padding: 10, borderRadius: 10, background: msg.role === 'ai' ? 'rgba(255,255,255,.02)' : 'rgba(99,102,241,.05)', border: '1px solid rgba(255,255,255,.03)' }}>
                          <div style={{ fontSize: 10, color: '#94a3b8' }}>{msg.text}</div>
                          <div style={{ fontSize: 7, color: '#475569', marginTop: 4, textTransform: 'uppercase' }}>{msg.engine || 'AI'}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    {deskLoading && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-100" />
                          <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-200" />
                        </div>
                        <span style={{ fontSize: 9, color: '#6366f1', fontWeight: 900, textTransform: 'uppercase' }}>
                          {voiceAiStatus || 'Processing...'}
                        </span>
                      </div>
                    )}
                    <div style={{ position: 'relative' }}>
                      <input 
                        value={deskInput} 
                        onChange={e => setDeskInput(e.target.value)} 
                        onKeyDown={e => e.key === 'Enter' && sendDeskChat()} 
                        placeholder="Ask Gemini for help..." 
                        style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 35px 10px 12px', fontSize: 12 }} 
                      />
                      <button onClick={sendDeskChat} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer' }}>
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* ── Nexus Voice AI Dock (Floating Camera & Mic) ── */}
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          
          {/* Status Bubble */}
          <AnimatePresence>
            {voiceAiOn && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} style={{ background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: '12px 20px', minWidth: 280, boxShadow: '0 20px 50px rgba(0,0,0,.5)', position: 'relative' }}>
                <button 
                  onClick={() => setVoiceAiOn(false)}
                  style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', zIndex: 10 }}
                >
                  <X size={14} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center', height: 12 }}>
                    {[0,1,2].map(i => (
                      <motion.div 
                        key={i} 
                        animate={{ 
                          height: (voiceAiListening || voiceAiSpeaking) ? [4, 12, 4] : 4,
                          opacity: (voiceAiListening || voiceAiSpeaking || voiceAiThinking) ? 1 : 0.3
                        }} 
                        transition={{ repeat: Infinity, duration: 0.6, delay: i*0.1 }} 
                        style={{ width: 3, background: '#6366f1', borderRadius: 2 }} 
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {voiceAiListening ? 'Listening...' : voiceAiThinking ? (voiceAiStatus || 'Thinking...') : voiceAiSpeaking ? 'Speaking...' : 'Nexus AI Ready'}
                  </span>
                  
                  {voiceAiListening && (
                    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 10, marginLeft: 4 }}>
                      {micActivity < 3 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 900 }}>
                            {micError ? 'MIC ERROR' : 'NO SOUND'}
                          </span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); resetVoiceAi(); }}
                            style={{ fontSize: 7, padding: '1px 4px', borderRadius: 3, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontWeight: 900 }}
                          >
                            RESET
                          </button>
                        </div>
                      )}
                      {[0,1,2,3,4].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: Math.max(2, (micActivity / 255) * 15 * (1 + Math.random())) }}
                          style={{ width: 2, background: micActivity > 20 ? '#10b981' : '#6366f1', borderRadius: 1 }}
                        />
                      ))}
                    </div>
                  )}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button 
                      onClick={() => setShowVoiceHelp(!showVoiceHelp)}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                    >
                      HELP
                    </button>
                    {voiceAiListening && voiceAiTranscript && (
                      <button 
                        onClick={() => { if(recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {} }}
                        style={{ fontSize: 8, padding: '4px 8px', borderRadius: 6, background: '#10b981', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 900, textTransform: 'uppercase' }}
                      >
                        Process Now
                      </button>
                    )}
                    <button 
                      onClick={() => setVoiceAiLang('en-IN')}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: voiceAiLang === 'en-IN' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                    >
                      EN
                    </button>
                    <button 
                      onClick={() => setVoiceAiLang('ml-IN')}
                      style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: voiceAiLang === 'ml-IN' ? '#6366f1' : 'rgba(255,255,255,0.05)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 900 }}
                    >
                      ML
                    </button>
                  </div>
                </div>
                {showVoiceHelp && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', marginBottom: 8 }}>Troubleshooting</div>
                    <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <li>Ensure you are in a quiet environment.</li>
                      <li>Check if the visualizer bars are moving when you speak.</li>
                      <li>Try clicking the "Reset AI" button below.</li>
                      <li>If on mobile, ensure the browser has mic permissions.</li>
                      <li>Try switching languages (EN/ML).</li>
                      <li><button onClick={testVoice} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 10, fontWeight: 900, cursor: 'pointer', padding: 0 }}>Test Audio Output</button></li>
                    </ul>
                    {micError && (
                      <div style={{ marginTop: 8, fontSize: 9, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                        Error: {micError}
                      </div>
                    )}
                    <button 
                      onClick={resetVoiceAi}
                      style={{ marginTop: 10, width: '100%', padding: '6px', borderRadius: 6, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 900 }}
                    >
                      RESET VOICE AI
                    </button>
                  </div>
                )}
                {voiceAiTranscript && (
                  <div style={{ fontSize: 13, color: '#fff', marginTop: 12, fontStyle: 'italic', borderLeft: '3px solid #6366f1', paddingLeft: 12, background: 'rgba(99,102,241,0.1)', padding: '8px 12px', borderRadius: '0 8px 8px 0' }}>
                    <span style={{ color: '#6366f1', fontWeight: 900, marginRight: 6, fontSize: 10, textTransform: 'uppercase' }}>Captured:</span> {voiceAiTranscript}
                  </div>
                )}
                {voiceAiReply && (
                  <div style={{ position: 'relative' }}>
                    <div className="markdown-body" style={{ fontSize: 11, marginTop: 8, paddingRight: 32 }}>
                      <ReactMarkdown>{voiceAiReply}</ReactMarkdown>
                    </div>
                    <button 
                      onClick={() => { fixAudio(); speakResponse(voiceAiReply); }} 
                      style={{ 
                        position: 'absolute', 
                        top: 0, 
                        right: 0, 
                        background: 'rgba(99,102,241,0.1)', 
                        border: 'none', 
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer', 
                        color: '#6366f1' 
                      }}
                      title="Fix Audio & Read Aloud"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                )}
                  {voiceAiThinking && !voiceAiReply && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i*0.2 }} style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />)}
                      </div>
                      <span style={{ fontSize: 10, color: '#6366f1', fontWeight: 600 }}>{voiceAiStatus || 'Nexus is thinking...'}</span>
                      <button 
                        onClick={() => { if(abortControllerRef.current) abortControllerRef.current.abort(); setVoiceAiThinking(false); setIsProcessing(false); isProcessingRef.current = false; }}
                        style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', fontWeight: 900, marginLeft: 'auto' }}
                      >
                        STOP
                      </button>
                    </div>
                  )}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 8, color: '#475569', fontWeight: 900, textTransform: 'uppercase' }}>
                      Engine: {activeEngine || (isOffline ? 'None' : 'Gemini 3 Flash')}
                    </span>
                    {voiceAiSpeaking && (
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[0,1,2].map(i => <motion.div key={i} animate={{ height: [2, 8, 2] }} transition={{ repeat: Infinity, duration: 0.5, delay: i*0.1 }} style={{ width: 2, background: '#10b981' }} />)}
                      </div>
                    )}
                  </div>
                  {(voiceAiReply || voiceAiThinking) && (
                    <button onClick={resetVoiceAi} style={{ fontSize: 8, color: '#6366f1', fontWeight: 900, textTransform: 'uppercase', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Reset
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Dock Pill */}
          <div style={{ background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(20px)', padding: '12px 24px', borderRadius: 40, border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,.8)' }}>
            <button onClick={() => { setCamOn(!camOn); setView('reading-room'); if(!camOn) startScan(); }} style={{ width: 48, height: 48, borderRadius: '50%', background: camOn ? '#6366f1' : 'rgba(255,255,255,.05)', border: 'none', color: camOn ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
              <Camera size={20} />
            </button>
            <motion.button 
              animate={voiceAiListening ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0px rgba(239, 68, 68, 0)", "0 0 20px rgba(239, 68, 68, 0.5)", "0 0 0px rgba(239, 68, 68, 0)"] } : { scale: 1 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              onClick={() => { fixAudio(); toggleVoiceAi(); }} 
              style={{ width: 56, height: 56, borderRadius: '50%', background: voiceAiOn ? '#ef4444' : '#6366f1', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', cursor: 'pointer' }}
            >
              {voiceAiOn ? <Square size={24} fill="#fff" /> : <Mic size={24} />}
            </motion.button>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Nexus Link</div>
              <div style={{ fontSize: 8, color: isLiveMode ? '#10b981' : voiceAiListening ? '#ef4444' : voiceAiThinking ? '#6366f1' : voiceAiOn ? '#10b981' : '#475569', fontWeight: 700 }}>
                {isLiveMode ? '● LIVE ACTIVE' : voiceAiListening ? '● LISTENING...' : voiceAiThinking ? '● THINKING...' : voiceAiOn ? '● ACTIVE' : 'STANDBY'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* --- ONBOARDING MODAL --- */}
      {showOnboarding && (
        <div className="absolute inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {onboardingStep === 1 && (
              <motion.div 
                key="step1"
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 1.1, opacity: 0, y: -20 }}
                className="bg-slate-900 border border-white/10 rounded-[40px] p-10 max-w-xl w-full text-center shadow-2xl shadow-black/50"
              >
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-indigo-500/20">
                  <Shield size={40} className="text-white" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter mb-2">Nexus <span className="text-indigo-500">Justice</span></h2>
                <p className="text-slate-500 mb-10 text-sm uppercase tracking-widest font-bold">Advocate Portal Login</p>
                
                <div className="space-y-4 mb-10">
                  {loginError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-left mb-4">
                      <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                      <div className="text-[10px] text-red-400 font-bold uppercase tracking-widest leading-tight">
                        {loginError}
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={handleGoogleLogin} 
                    className="w-full py-5 bg-white text-black hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg"
                  >
                    <Icon path="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" size={20} />
                    Connect Google Account
                  </button>
                </div>
                
                <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold">
                  Nexus uses your own Google account to provide AI capabilities.
                </p>
              </motion.div>
            )}

            {onboardingStep === 2 && (
              <motion.div 
                key="step2"
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 1.1, opacity: 0, y: -20 }}
                className="bg-slate-900 border border-white/10 rounded-[40px] p-8 max-w-2xl w-full shadow-2xl shadow-black/50"
              >
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Brain size={28} className="text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-2xl font-black italic tracking-tighter">Connect to <span className="text-indigo-500">Brain</span></h2>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Bring Your Own Key (BYOK)</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-black text-[9px]">1</div>
                      <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-300">Create Key</h3>
                    </div>
                    <div className="aspect-video bg-[#f8f9fa] rounded-lg border border-white/5 overflow-hidden relative group scale-95">
                      {/* Mock Google AI Studio UI */}
                      <div className="p-2 h-full flex flex-col">
                        <div className="flex items-center gap-1 mb-2 border-b border-gray-200 pb-1">
                          <div className="w-2 h-2 bg-gray-300 rounded-sm"></div>
                          <div className="h-1.5 w-12 bg-gray-200 rounded"></div>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="text-[10px] font-bold text-gray-800">API Keys</h4>
                          <div className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[6px] text-gray-700 shadow-sm">
                            Create API key
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="h-4 w-full bg-gray-100 rounded border border-gray-200"></div>
                        </div>
                      </div>
                      
                      {/* Red Overlay from Screenshot */}
                      <div className="absolute top-0 right-1 flex flex-col items-end z-10 scale-[0.6] origin-top-right">
                        <div className="bg-[#FF4B5C] text-[10px] font-bold px-3 py-1.5 rounded-lg text-white shadow-lg mb-1 relative">
                          Click here to create APIKey
                          <div className="absolute -bottom-1 right-4 w-2 h-2 bg-[#FF4B5C] rotate-45"></div>
                        </div>
                        <div className="w-24 h-10 border-4 border-[#FF4B5C] rounded-xl"></div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-black text-[9px]">2</div>
                      <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-300">Copy Key</h3>
                    </div>
                    <div className="aspect-video bg-[#f8f9fa] rounded-lg border border-white/5 overflow-hidden relative group scale-95">
                      {/* Mock Key List UI */}
                      <div className="p-2 h-full flex flex-col bg-white">
                        <div className="flex gap-1 mb-2">
                          <div className="px-1.5 py-0.5 bg-gray-100 rounded-full text-[6px] text-gray-500">API key</div>
                          <div className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-full text-[6px] text-gray-500">Project</div>
                        </div>
                        <div className="p-1.5 border border-gray-100 rounded-md">
                          <div className="flex items-center justify-between mb-1">
                            <div className="h-2 w-10 bg-blue-50 rounded"></div>
                            <div className="flex gap-1.5">
                              <div className="w-4 h-4 border border-gray-200 rounded flex items-center justify-center">
                                <Copy size={8} className="text-gray-400" />
                              </div>
                              <div className="w-4 h-4 border border-gray-200 rounded"></div>
                            </div>
                          </div>
                          <div className="h-1.5 w-20 bg-gray-50 rounded"></div>
                        </div>
                      </div>

                      {/* Red Overlays from Screenshot */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 scale-[0.6] origin-top">
                        <div className="bg-[#FF4B5C] text-[10px] font-bold px-4 py-2 rounded-lg text-white shadow-lg relative whitespace-nowrap">
                          Click here to copy key
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#FF4B5C] rotate-45"></div>
                        </div>
                      </div>
                      <div className="absolute top-6 right-6 w-6 h-6 border-4 border-[#FF4B5C] rounded-lg z-10"></div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 font-black text-[9px]">3</div>
                      <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-300">Return</h3>
                    </div>
                    <div className="aspect-video bg-[#f8f9fa] rounded-lg border border-white/5 overflow-hidden relative group scale-95">
                      {/* Mock Return UI - Refined to match screenshot */}
                      <div className="p-2 h-full flex flex-col bg-white">
                        <div className="space-y-2 mt-1 px-1">
                          <div className="flex justify-between items-center">
                            <div className="text-[6px] text-gray-400 font-medium">Project ID</div>
                            <div className="text-[6px] text-gray-800 font-mono">gen-lang-client-0754986454</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-[6px] text-gray-400 font-medium">Created</div>
                            <div className="text-[6px] text-gray-800">Apr 7, 2026</div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-[6px] text-gray-400 font-medium">Billing tier</div>
                            <div className="text-[6px] text-blue-500 font-medium">Free</div>
                          </div>
                        </div>
                        
                        {/* Mobile Navigation Bar Mock */}
                        <div className="absolute bottom-0 left-0 right-0 h-6 bg-white border-t border-gray-100 flex items-center justify-around px-4">
                          {/* Hamburger icon */}
                          <div className="flex flex-col gap-[1px]">
                            <div className="w-2.5 h-[1px] bg-gray-300"></div>
                            <div className="w-2.5 h-[1px] bg-gray-300"></div>
                            <div className="w-2.5 h-[1px] bg-gray-300"></div>
                          </div>
                          {/* Square icon */}
                          <div className="w-2.5 h-2.5 border border-gray-300 rounded-[1px]"></div>
                          {/* Triangle icon (Back) */}
                          <div className="w-0 h-0 border-t-[3px] border-t-transparent border-r-[5px] border-r-gray-400 border-b-[3px] border-b-transparent"></div>
                        </div>
                      </div>

                      {/* Red Overlays from Screenshot */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] z-10 scale-[0.65]">
                        <div className="bg-[#FF4B5C] text-[10px] font-bold px-4 py-3 rounded-lg text-white shadow-lg text-center leading-tight">
                          click here to close and return to app
                        </div>
                      </div>

                      {/* Red highlight around back button */}
                      <div className="absolute bottom-0.5 right-3 w-6 h-5 border-4 border-[#FF4B5C] rounded-lg z-10"></div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-full py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    <ExternalLink size={18} className="text-indigo-500" />
                    Open Google AI Studio
                  </a>

                  <div className="relative group">
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-3 ml-1">
                      Paste API Key in the box below:
                    </label>
                    <input 
                      type="password"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder="Paste your Gemini API Key here..."
                      className="w-full py-6 px-8 bg-indigo-500/10 border-2 border-indigo-500/40 rounded-3xl text-white font-bold text-lg focus:border-indigo-400 focus:bg-indigo-500/20 outline-none transition-all placeholder:text-indigo-300/30 shadow-[0_0_30px_rgba(99,102,241,0.1)] hover:border-indigo-500/60"
                    />
                    <div className="absolute right-6 top-[calc(50%+12px)] -translate-y-1/2 flex items-center gap-2">
                      {userApiKey && <CheckCircle size={22} className="text-emerald-500" />}
                    </div>
                  </div>

                  <button 
                    onClick={handleConnectToBrain}
                    disabled={isKeyValidating || !userApiKey.trim()}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                  >
                    {isKeyValidating ? <RefreshCw size={20} className="animate-spin" /> : <Zap size={20} />}
                    Connect to Brain
                  </button>
                </div>

                <div className="mt-8 flex items-center justify-center gap-2 text-slate-500">
                  <Volume2 size={14} className="animate-pulse text-indigo-500" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Voice Guidance Active</p>
                </div>
              </motion.div>
            )}

            {onboardingStep === 4 && (
              <motion.div 
                key="step4"
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                className="bg-slate-900 border border-white/10 rounded-[40px] p-10 max-w-xl w-full text-center"
              >
                <div className="w-20 h-20 bg-emerald-500 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-2xl shadow-emerald-500/20">
                  <CheckCircle size={40} className="text-white" />
                </div>
                <h2 className="text-4xl font-black italic tracking-tighter mb-4">You're <span className="text-emerald-500">All Set!</span></h2>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Nexus Justice is now connected to your Google AI engine.<br/>
                  Your legal database is ready for secure orchestration.
                </p>
                
                <button 
                  onClick={() => {
                    setShowOnboarding(false);
                    localStorage.setItem('onboarding_complete', 'true');
                  }}
                  className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                >
                  Enter Command Center
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tutorial Modal */}
          <AnimatePresence>
            {showTutorial && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="bg-slate-900 border border-white/10 rounded-[40px] max-w-4xl w-full overflow-hidden shadow-2xl"
                >
                  <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                        <Play size={20} className="text-white fill-white ml-0.5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter">Setup <span className="text-indigo-500">Tutorial</span></h3>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">How to get your Gemini API Key</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowTutorial(false)}
                      className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X size={20} className="text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="min-h-[400px] bg-black relative overflow-y-auto">
                    {/* Tutorial Content - Using a stylized layout */}
                    <div className="flex flex-col items-center justify-center p-6 md:p-12 text-center">
                      <div className="w-full max-w-2xl space-y-6 md:space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                          {[
                            { step: 1, title: "Open Studio", desc: "Click 'Open Google AI Studio' below" },
                            { step: 2, title: "Create Key", desc: "Click the red 'Create API key' button" },
                            { step: 3, title: "Copy & Return", desc: "Copy the key and return to paste it" }
                          ].map((s) => (
                            <div key={s.step} className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-2xl flex md:flex-col items-center gap-4 md:gap-0">
                              <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-xs font-black md:mb-3 flex-shrink-0">{s.step}</div>
                              <div className="text-left md:text-center">
                                <h4 className="text-sm font-bold text-white mb-0.5 md:mb-1">{s.title}</h4>
                                <p className="text-[10px] text-slate-500 leading-tight">{s.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="relative p-1 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/20">
                          <div className="bg-slate-950 rounded-xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 md:gap-4">
                              <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                                <Copy size={20} className="text-indigo-400 md:hidden" />
                                <Copy size={24} className="text-indigo-400 hidden md:block" />
                              </div>
                              <div className="text-left">
                                <div className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5 md:mb-1">Your Key</div>
                                <div className="text-sm md:text-lg font-mono text-white tracking-widest">AIzaSy...XXXXX</div>
                              </div>
                            </div>
                            <div className="w-full md:w-auto px-6 py-2 bg-indigo-600 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest text-center">Copied!</div>
                          </div>
                        </div>

                        <p className="text-sm text-slate-400 italic">"The process is simple and secure. Your key stays on your device."</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 md:p-8 bg-slate-950/50 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3 md:gap-4 text-slate-400">
                      <Info size={16} className="text-indigo-400 flex-shrink-0" />
                      <p className="text-[10px] md:text-xs">Need more help? Visit the <a href="https://ai.google.dev/gemini-api/docs/api-key" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">official documentation</a>.</p>
                    </div>
                    <button 
                      onClick={() => setShowTutorial(false)}
                      className="w-full md:w-auto px-8 py-3 bg-white text-slate-900 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-xs hover:bg-slate-200 transition-colors"
                    >
                      Got it, thanks!
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
