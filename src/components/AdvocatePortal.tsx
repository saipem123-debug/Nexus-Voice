import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Mic, Camera, FileText, Users, Bell, HelpCircle, 
  BookOpen, Edit3, Layout, MessageSquare, Settings, 
  Download, Globe, Wifi, WifiOff, Shield, Save, Trash2,
  ChevronLeft, ChevronRight, Play, Square, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Info, X, Search, Plus, RotateCcw,
  Volume2, Send, Trash, Check, AlertCircle, RefreshCw, Zap, Brain,
  Maximize2, Minimize2, FileUp, Languages
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import { HybridAIEngine, AIMessage } from "../lib/ai-engine";
import { LocalDB } from "../lib/local-db";
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
  const [installingBrain, setInstallingBrain] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const handleInstallBrain = useCallback(async () => {
    setInstallingBrain(true);
    setInstallProgress(0);
    setShowInstallBanner(false);
    try {
      await aiEngine.pullModel((percent) => {
        setInstallProgress(percent);
      });
      await aiEngine.updateStatus();
      const status = aiEngine.getStatus();
      setAiStatus(status);
      setInstallingBrain(false);
      // No alert, just let the status update
    } catch (e) {
      console.error(e);
      setInstallingBrain(false);
      // Show banner again if failed
      setShowInstallBanner(true);
    }
  }, []);
  const [installSlice, setInstallSlice] = useState(0);

  // AI Engine & DB
  const aiEngine = HybridAIEngine.getInstance();
  const localDB = LocalDB.getInstance();
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- State from Snippet ---
  const [clients, setClients] = useState<any[]>([]);
  const [addingClient, setAddingClient] = useState(false);
  const [newClient, setNewClient] = useState<any>({});
  const [chatHistory, setChatHistory] = useState<AIMessage[]>([]);
  const [consoleInput, setConsoleInput] = useState("");
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, message: "Welcome to Nexus Justice v3.1 Hybrid. Your offline brain is ready for download.", date: "2026-03-24", read: false, type: 'general' },
  ]);
  const [supportMsgs, setSupportMsgs] = useState([{ id: 1, role: 'ai', text: 'Hello. I am the Nexus Support AI. Please describe any issues you are facing with the platform.' }]);
  const [supportInput, setSupportInput] = useState("");
  const [supportLoading, setSupportLoading] = useState(false);
  
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
  const [voiceAiOn, setVoiceAiOn] = useState(false);
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
  const [kbFilter, setKbFilter] = useState('all');
  const [kbSearch, setKbSearch] = useState('');

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
        const savedClients = localDB.query("SELECT * FROM clients") as any[];
        if (savedClients.length > 0) {
          setClients(savedClients);
        } else {
          const initial = [
            { id: 1, name: 'Sreedharan K.', phone: '+91 9876543210', court: 'District Court, Aluva', case_number: 'OS 145/2025', next_date: '2026-03-15', purpose: 'Filing Written Statement' },
            { id: 2, name: 'Elena Rodriguez', phone: '+1 555-0199', court: 'High Court', case_number: 'WP(C) 204/2026', next_date: '2026-03-20', purpose: 'Hearing' },
          ];
          initial.forEach(c => {
            localDB.run("INSERT INTO clients (name, phone, case_number, court, next_date, purpose) VALUES (?, ?, ?, ?, ?, ?)", 
              [c.name, c.phone, c.case_number, c.court, c.next_date, c.purpose]);
          });
          setClients(initial);
        }

        const savedHistory = localDB.query("SELECT * FROM chat_history ORDER BY id ASC") as any[];
        if (savedHistory.length > 0) {
          setChatHistory(savedHistory.map(h => ({ id: h.id, role: h.role, content: h.content, engine: h.engine })));
        }
      } catch (err) {
        console.error("Database initialization failed:", err);
        // Fallback to in-memory mock data if DB fails
        setClients([
          { id: 1, name: 'Sreedharan K. (Offline)', phone: '+91 9876543210', court: 'District Court, Aluva', case_number: 'OS 145/2025', next_date: '2026-03-15', purpose: 'Filing Written Statement' },
          { id: 2, name: 'Elena Rodriguez (Offline)', phone: '+1 555-0199', court: 'High Court', case_number: 'WP(C) 204/2026', next_date: '2026-03-20', purpose: 'Hearing' },
        ]);
      }
      
      const checkStatus = async () => {
        const status = aiEngine.getStatus();
        try {
          // Ping Ollama to see if it's actually running and if model is present
          const res = await axios.get('http://localhost:11434/api/tags', { timeout: 2000 });
          const models = res.data.models || [];
          const hasGemma = models.some((m: any) => m.name.includes('gemma3') && m.name.includes('1b'));
          status.ollamaReady = hasGemma;
        } catch (e) {
          status.ollamaReady = false;
        }
        setAiStatus(status);
      };
      
      checkStatus();
      const statusInterval = setInterval(checkStatus, 10000);
      
      if (localStorage.getItem('onboarding_complete')) setShowOnboarding(false);
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
      const response = await aiEngine.generateResponse(prompt, [], 'sarvam');
      const aiResponse = response.text;
      
      const updatedCall = {
        ...call,
        duration: "45s",
        transcript: [
          { role: "client", text: "Hello? Is the advocate there?" },
          { role: "ai", text: aiResponse }
        ],
        summary: `AI Auto-Answered (Sarvam): ${aiResponse.substring(0, 50)}...`
      };

      // In a real app, we'd add to SIMULATED_CALLS or DB
      setNotifications(prev => [{
        id: Date.now(),
        message: `AI Auto-Answered a call from ${call.clientName} using Sarvam.`,
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
    setVoiceAiStatus("Translating (Sarvam Mayura)...");
    
    try {
      const translated = await aiEngine.sarvamTranslate(converterInputText, converterTargetLang);
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
      setVoiceAiStatus("Sarvam Vision is reading...");

      // Now use Sarvam Vision to analyze the document image
      const visionPrompt = `I have scanned a legal document. Please analyze this document, identify the parties involved, the main obligations, and any potential legal risks. Use a professional legal tone.`;

      const visionResponse = await aiEngine.sarvamVision(visionPrompt, imageBase64);
      
      if (visionResponse) {
        setScannedText(prev => {
          const baseText = prev ? `--- EXTRACTED TEXT ---\n${prev}\n\n` : "";
          return `${baseText}--- SARVAM VISION ANALYSIS ---\n${visionResponse}`;
        });
        speakResponse(visionResponse);
      } else if (extractedText && extractedText.trim().length >= 5) {
        // Fallback to Gemma 3 if Sarvam Vision fails but we have OCR text
        setVoiceAiStatus("Gemma 3 is reading...");
        const gemmaPrompt = `I have scanned a legal document. Here is the extracted text:
        
        --- START OF TEXT ---
        ${extractedText}
        --- END OF TEXT ---
        
        Please analyze this document, identify the parties involved, the main obligations, and any potential legal risks. Use a professional legal tone.`;

        const response = await aiEngine.generateResponse(
          gemmaPrompt, 
          [], 
          'ollama', // Force Gemma 3
          undefined, 
          undefined, 
          (status) => setVoiceAiStatus(status)
        );

        setScannedText(prev => `--- EXTRACTED TEXT ---\n${prev}\n\n--- GEMMA 3 ANALYSIS ---\n${response.text}`);
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
      .replace(/Offline Brain \(Gemma 3\):/gi, '')
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
    if (!caseFacts.trim() && !writingPad.trim()) {
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Please provide some facts or notes in the writing pad first.", engine: 'Nexus AI' }]);
      return;
    }
    
    setDeskLoading(true);
    setVoiceAiStatus("Sarvam AI is drafting...");
    
    const prompt = `Draft a legal petition/plaint based on the following facts:
    
    FACTS:
    ${caseFacts}
    
    NOTES:
    ${writingPad}
    
    ${draftingModel ? `USE THIS MODEL/TEMPLATE AS A GUIDE:\n${draftingModel}` : ''}
    
    Please provide a professional legal draft.`;

    try {
      // Force Sarvam for drafting
      const response = await aiEngine.generateResponse(prompt, [], 'sarvam', undefined, undefined, (status) => setVoiceAiStatus(status));
      setDraftPages([response.text]);
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Draft generated by Sarvam AI. Check the main editor.", engine: 'Sarvam AI' }]);
      
      // Get suggestions after drafting
      getAiSuggestions(response.text);
    } catch (err) {
      console.error(err);
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: "Drafting failed. Please try again.", engine: 'Error' }]);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const getAiSuggestions = async (draft: string) => {
    setVoiceAiStatus("Gemini is analyzing...");
    const prompt = `Analyze this legal draft and provide 3-4 specific suggestions for improvement or missing legal points. Format as a list.
    
    DRAFT:
    ${draft}`;

    try {
      // Force Gemini for suggestions
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      const suggestions = response.text.split('\n').filter(s => s.trim().length > 5).slice(0, 4);
      setAiSuggestions(suggestions);
    } catch (err) {
      console.error(err);
    }
  };

  const getAiGuidance = async () => {
    if (!caseFacts.trim()) return;
    setVoiceAiStatus("Gemini is preparing questions...");
    const prompt = `Based on the facts provided, ask 3 legally relevant questions to help the advocate refine the drafting.
    
    FACTS:
    ${caseFacts}`;

    try {
      // Force Gemini for guidance
      const response = await aiEngine.generateResponse(prompt, [], 'gemini', undefined, undefined, (status) => setVoiceAiStatus(status));
      const questions = response.text.split('\n').filter(q => q.trim().length > 5).slice(0, 3);
      setAiQuestions(questions);
    } catch (err) {
      console.error(err);
    }
  };

  const integrateSuggestion = async (suggestion: string) => {
    setDeskLoading(true);
    setVoiceAiStatus("Sarvam is integrating suggestion...");
    const prompt = `Update the following legal draft by integrating this suggestion: "${suggestion}"
    
    CURRENT DRAFT:
    ${draftPages[0]}`;

    try {
      const response = await aiEngine.generateResponse(prompt, [], 'sarvam', undefined, undefined, (status) => setVoiceAiStatus(status));
      setDraftPages([response.text]);
      setAiSuggestions(prev => prev.filter(s => s !== suggestion));
    } catch (err) {
      console.error(err);
    } finally {
      setDeskLoading(false);
      setVoiceAiStatus("");
    }
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleRecordFacts = async () => {
    if (isRecordingFacts) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingFacts(false);
      setVoiceAiStatus("");
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            setVoiceAiStatus("Sarvam STT is transcribing...");
            const transcript = await aiEngine.sarvamSTT(base64Audio);
            if (transcript) {
              setCaseFacts(prev => prev + (prev ? ' ' : '') + transcript);
            }
            setVoiceAiStatus("");
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecordingFacts(true);
        setVoiceAiStatus("Recording facts (Sarvam STT)...");
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
    
    // Try Sarvam TTS (Bulbul V3) first
    const sarvamAudio = await aiEngine.sarvamTTS(text);
    if (sarvamAudio) {
      console.log("Using Sarvam TTS (Bulbul V3) for speech.");
      const audio = new Audio(`data:audio/wav;base64,${sarvamAudio}`);
      audio.onplay = () => {
        setVoiceAiSpeaking(true);
        isSpeakingRef.current = true;
      };
      audio.onended = () => {
        setVoiceAiSpeaking(false);
        isSpeakingRef.current = false;
      };
      audio.onerror = (e) => {
        console.error("Sarvam TTS playback error:", e);
        setVoiceAiSpeaking(false);
        isSpeakingRef.current = false;
        // Fallback to browser TTS if Sarvam playback fails
        fallbackToBrowserTTS(text);
      };
      audio.play().catch(e => {
        console.error("Sarvam TTS play failed:", e);
        fallbackToBrowserTTS(text);
      });
      return;
    }

    // Fallback to browser TTS
    fallbackToBrowserTTS(text);
  }, []);

  const fallbackToBrowserTTS = (text: string) => {
    console.log("Falling back to Browser TTS.");
    window.speechSynthesis.cancel();
    
    // Set speaking state immediately
    setVoiceAiSpeaking(true);
    isSpeakingRef.current = true;
    
    const cleanText = sanitizeForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Detect Malayalam characters (\u0D00-\u0D7F)
    const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
    const lang = hasMalayalam ? 'ml-IN' : 'en-US';
    utterance.lang = lang;

    // Try to find a consistent voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith(lang) && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha'))) 
                         || voices.find(v => v.lang.startsWith(lang));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setVoiceAiSpeaking(true);
      isSpeakingRef.current = true;
    };
    utterance.onend = () => {
      setVoiceAiSpeaking(false);
      isSpeakingRef.current = false;
    };
    utterance.onerror = (e) => {
      console.error("Speech synthesis error:", e);
      setVoiceAiSpeaking(false);
      isSpeakingRef.current = false;
    };
    
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
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
    if (voiceAiOn && !voiceAiListening && !voiceAiThinking && !voiceAiSpeaking && !isProcessing && !isStartingRef.current) {
      const timer = setTimeout(() => {
        if (voiceAiOn && !voiceAiListening && !voiceAiThinking && !voiceAiSpeaking && !isProcessing && !isStartingRef.current) {
          startVoiceAi();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [voiceAiOn, voiceAiListening, voiceAiThinking, voiceAiSpeaking, isProcessing, startVoiceAi]);

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
    window.speechSynthesis.cancel();
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

  const resetVoiceAi = useCallback(() => {
    console.log("Resetting Voice AI...");
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
    const checkNeedInstall = async () => {
      // If Ollama is running but Gemma 3 is missing, show the banner
      if (!aiStatus.ollamaReady && !aiStatus.offlineBrain && navigator.onLine) {
        // Double check if Ollama is even reachable
        try {
          const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2000) });
          if (res.ok) {
            setShowInstallBanner(true);
          }
        } catch (e) {
          // Ollama not running at all, don't show banner yet
        }
      }
    };
    checkNeedInstall();
  }, [aiStatus.ollamaReady, aiStatus.offlineBrain]);

  // --- Sidebar & Tab Config ---
  const sideNav = [
    { id: 'command', label: 'Command', icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
    { id: 'feed', label: 'Feed', icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
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
    page: { display: 'flex', height: '100vh', background: '#020617', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', fontSize: 14 },
    sidebar: { width: 72, background: '#070b14', borderRight: '1px solid rgba(255,255,255,.05)', display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center', padding: '20px 0', gap: 8, flexShrink: 0, overflowY: 'auto' as const },
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
      <div style={S.sidebar}>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="text-sm font-black tracking-widest uppercase">
              Nexus <span className="text-indigo-500">Justice</span> <span className="text-[10px] text-slate-500 ml-2">v3.1 Hybrid</span>
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className={`px-3 py-1 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
              isOffline ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {isOffline ? <WifiOff size={12} /> : <Wifi size={12} />}
              {isOffline ? 'Local Mode' : 'Cloud Active'}
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ padding: '4px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={refreshAiStatus} title="Refresh AI Status" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={10} />
              </button>
              
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)' }} />

              {/* Gemini Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatus.geminiReady ? '#10b981' : '#f43f5e', display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontWeight: 900, color: aiStatus.geminiReady ? '#10b981' : '#f43f5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Gemini 2.5: {aiStatus.geminiReady ? 'Active' : 'Offline'}
                </span>
              </div>
              
              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)' }} />

              {/* Sarvam Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatus.sarvamReady ? '#10b981' : '#f43f5e', display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontWeight: 900, color: aiStatus.sarvamReady ? '#10b981' : '#f43f5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Sarvam: {aiStatus.sarvamReady ? 'Active' : 'Offline'}
                </span>
              </div>

              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)' }} />

              {/* Gemma 3 Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-a" style={{ 
                  width: 6, height: 6, borderRadius: '50%', 
                  background: aiStatus.ollamaReady ? '#10b981' : aiStatus.offlineBrain ? '#f59e0b' : '#f43f5e', 
                  display: 'inline-block' 
                }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ 
                      fontSize: 9, fontWeight: 900, 
                      color: aiStatus.ollamaReady ? '#10b981' : aiStatus.offlineBrain ? '#f59e0b' : '#f43f5e', 
                      letterSpacing: '0.1em', textTransform: 'uppercase' 
                    }}>
                      Gemma 3: {aiStatus.ollamaReady ? 'Active' : aiStatus.offlineBrain ? 'Offline (Installed)' : 'Not Installed'}
                    </span>
                    <button onClick={refreshAiStatus} title="Refresh Gemma 3 Status" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <RotateCcw size={8} />
                    </button>
                  </div>
                  {!aiStatus.ollamaReady && (
                    <button onClick={() => setView('config')} style={{ fontSize: 7, color: '#f59e0b', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', textDecoration: 'underline', fontWeight: 900, textTransform: 'uppercase' }}>
                      {aiStatus.offlineBrain ? 'Check Connection' : 'Install Brain'}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,.1)' }} />

              {/* Transformers.js Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatus.transformersReady ? '#10b981' : aiStatus.transformersLoading ? '#f59e0b' : '#f43f5e', display: 'inline-block' }} />
                <span style={{ fontSize: 9, fontWeight: 900, color: aiStatus.transformersReady ? '#10b981' : aiStatus.transformersLoading ? '#f59e0b' : '#f43f5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Browser AI: {aiStatus.transformersReady ? 'Ready' : aiStatus.transformersLoading ? 'Loading...' : 'Offline'}
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

        {/* INSTALL BANNER */}
        {showInstallBanner && (
          <div style={{ background: '#f59e0b', color: '#000', padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Brain size={14} />
              <span>Nexus Justice needs to download its local brain (Gemma 3) for offline legal support.</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleInstallBrain} style={{ background: '#000', color: '#f59e0b', border: 'none', padding: '4px 12px', borderRadius: 6, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>
                Download & Install Now
              </button>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: 'none', border: 'none', color: '#000', cursor: 'pointer', opacity: 0.6 }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* INSTALL PROGRESS OVERLAY */}
        {installingBrain && (
          <div style={{ position: 'fixed', bottom: 24, right: 24, width: 300, background: '#0a0f1d', border: '1px solid #f59e0b', borderRadius: 16, padding: 20, zIndex: 1000, boxShadow: '0 10px 40px rgba(0,0,0,0.5)', animation: 'fadeUp 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="spin" style={{ color: '#f59e0b' }}>
                <RotateCcw size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#f59e0b' }}>Downloading Brain...</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Gemma 3-1B-it (Ollama)</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{installProgress}%</div>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#f59e0b', width: `${installProgress}%`, transition: 'width 0.1s' }} />
            </div>
            <p style={{ fontSize: 9, color: '#475569', marginTop: 12, margin: 0, lineHeight: 1.4 }}>
              This will take a few minutes. You can continue using the app while the brain downloads.
            </p>
          </div>
        )}

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
              <motion.div key="command" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', gap: 24, padding: 24, overflow: 'hidden' }}>
                <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                  <div style={S.card}>
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
                    <div style={{ color: '#f59e0b', fontSize: 9, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>Hybrid AI Node</div>
                    <h3 style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', letterSpacing: '-0.03em', marginBottom: 16 }}>Command<span style={{ color: '#475569' }}>Center</span></h3>
                    
                    {/* Voice Node Controls */}
                    <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 16, padding: 16, border: '1px solid rgba(255,255,255,.05)', marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>Voice Node</span>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button onClick={() => setVoiceAiOn(!voiceAiOn)} style={{ flex: 1, padding: '8px 0', background: voiceAiOn ? '#ef4444' : '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 10, fontWeight: 900 }}>{voiceAiOn ? 'Stop' : 'Start'}</button>
                        <button 
                          onClick={() => {
                            if (aiStatus.offlineBrain) return;
                            setInstallingBrain(true);
                            setInstallProgress(0);
                            const interval = setInterval(() => {
                              setInstallProgress(prev => {
                                if (prev >= 100) {
                                  clearInterval(interval);
                                  localStorage.setItem('offline_brain_installed', 'true');
                                  setAiStatus(aiEngine.getStatus());
                                  setInstallingBrain(false);
                                  alert("Offline Brain (Gemma 3-1B-it) installed successfully. Note: This is a simulation. For real local inference, install Ollama.");
                                  return 100;
                                }
                                return prev + 5;
                              });
                            }, 100);
                          }} 
                          disabled={installingBrain}
                          style={{ 
                            flex: 1, 
                            padding: '8px 0', 
                            background: aiStatus.offlineBrain ? 'rgba(16,185,129,.1)' : installingBrain ? 'rgba(255,255,255,.05)' : 'rgba(245,158,11,.1)', 
                            border: aiStatus.offlineBrain ? '1px solid rgba(16,185,129,.3)' : '1px solid rgba(245,158,11,.3)', 
                            borderRadius: 8, 
                            color: aiStatus.offlineBrain ? '#10b981' : '#f59e0b', 
                            fontSize: 10, 
                            fontWeight: 900,
                            position: 'relative',
                            overflow: 'hidden'
                          }}
                        >
                          {installingBrain ? `Installing ${installProgress}%` : aiStatus.offlineBrain ? 'Brain Ready' : 'Install Brain'}
                          {installingBrain && (
                            <div style={{ position: 'absolute', bottom: 0, left: 0, height: 2, background: '#f59e0b', width: `${installProgress}%`, transition: 'width 0.1s' }} />
                          )}
                        </button>
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
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900 }}>Browser-side AI</h3>
                        <p style={{ fontSize: 11, color: '#475569' }}>Transformers.js (Zero-install)</p>
                      </div>
                    </div>
                    
                    <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Status: {aiStatus.transformersReady ? 'Ready' : aiStatus.transformersLoading ? 'Initializing...' : 'Not Initialized'}</div>
                        <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                          Transformers.js runs AI directly in your browser using WebGPU or WASM. 
                          No local server required. The model is downloaded once and cached.
                        </p>
                      </div>
                      
                      {aiStatus.transformersLoading ? (
                        <div style={{ textAlign: 'center', padding: 10 }}>
                          <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2" />
                          <div style={{ fontSize: 10, color: '#6366f1', fontWeight: 900 }}>INITIALIZING ENGINE...</div>
                        </div>
                      ) : aiStatus.transformersReady ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                          <CheckCircle size={16} /> Browser AI is active.
                        </div>
                      ) : (
                        <button 
                          onClick={async () => {
                            await aiEngine.initTransformers();
                            setAiStatus(aiEngine.getStatus());
                          }}
                          style={{ width: '100%', padding: '14px', background: '#6366f1', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
                        >
                          Activate Browser AI
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={S.card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                        <Download size={20} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: 16, fontWeight: 900 }}>Offline Brain Facility</h3>
                        <p style={{ fontSize: 11, color: '#475569' }}>Local legal AI installation (Ollama)</p>
                      </div>
                    </div>
                    
                    <div style={{ background: 'rgba(255,255,255,.02)', borderRadius: 16, padding: 20, border: '1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Status: {aiStatus.offlineBrain ? 'Installed' : 'Not Installed'}</div>
                        <p style={{ fontSize: 11, color: '#64748b', lineHeight: 1.5 }}>
                          The Offline Brain (Gemma 3-1B-it) allows you to process legal queries without an internet connection. 
                          This is essential for high-privacy consultations.
                        </p>
                      </div>
                      
                      {installingBrain ? (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 900, marginBottom: 6, textTransform: 'uppercase' }}>
                            <span>Downloading Gemma 3-1B-it...</span>
                            <span>{installProgress}%</span>
                          </div>
                          <div style={{ height: 6, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#f59e0b', width: `${installProgress}%`, transition: 'width 0.1s' }} />
                          </div>
                        </div>
                      ) : aiStatus.ollamaReady ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 12, fontWeight: 700 }}>
                          <CheckCircle size={16} /> Gemma 3 is active and ready for offline use.
                        </div>
                      ) : aiStatus.offlineBrain ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 12, fontWeight: 700 }}>
                            <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500" /> 
                            Gemma 3 is installed but the server is unreachable.
                          </div>
                          <button 
                            onClick={refreshAiStatus}
                            style={{ width: '100%', padding: '12px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 12, color: '#f59e0b', fontWeight: 900, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                          >
                            <RotateCcw size={14} /> Retry Connection
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={handleInstallBrain}
                          style={{ width: '100%', padding: '14px', background: '#f59e0b', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
                        >
                          Install Gemma 3 Now
                        </button>
                      )}
                    </div>
                    <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,.05)' }}>
                      <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
                        The Offline Brain (Gemma 3) allows you to process legal queries without an internet connection. 
                        It is a compact yet powerful model optimized for legal reasoning.
                      </p>
                      {!aiStatus.ollamaReady && (
                        <p style={{ fontSize: 9, color: '#64748b', marginTop: 12, borderTop: '1px solid rgba(255,255,255,.05)', paddingTop: 8 }}>
                          <strong>Troubleshooting:</strong> If the brain won't install, ensure Ollama is running and set the environment variable <code>OLLAMA_ORIGINS="*"</code> on your computer.
                        </p>
                      )}
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
                        <span style={{ fontSize: 12 }}>Cloud Sync</span>
                        <div style={{ width: 32, height: 18, borderRadius: 9, background: '#1e293b', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 2, left: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* FEED */}
            {view === 'feed' && (
              <motion.div key="feed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 24, display: 'flex', gap: 20 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={S.card}>
                    <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 16 }}>Upcoming Hearings</div>
                    {clients.slice(0, 3).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>{c.name[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>{c.case_number} · {c.court}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>{c.next_date}</div>
                          <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{c.purpose}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* CONSULT */}
            {view === 'consult' && (
              <motion.div key="consult" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, gap: 12, overflow: 'hidden' }}>
                <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                    {chatHistory.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                        <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: 20, background: msg.role === 'user' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}`, fontSize: 13, lineHeight: 1.7, position: 'relative' }}>
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
                    <input value={consoleInput} onChange={e => setConsoleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendConsult()} placeholder="Ask anything legal..." style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '13px 18px' }} />
                    {consoleLoading ? (
                      <button onClick={() => { if(abortControllerRef.current) abortControllerRef.current.abort(); setConsoleLoading(false); }} style={{ padding: '13px 22px', background: '#ef4444', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Square size={14} fill="currentColor" /> Stop
                      </button>
                    ) : (
                      <button onClick={() => sendConsult()} style={{ padding: '13px 22px', background: '#6366f1', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900 }}>Send</button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* CLIENTS */}
            {view === 'clients' && (
              <motion.div key="clients" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 32, fontWeight: 900, fontStyle: 'italic' }}>Client Registry</h2>
                  <button onClick={() => setAddingClient(true)} style={{ padding: '11px 22px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 14, color: '#f59e0b', fontWeight: 900 }}>+ Add Client</button>
                </div>
                <div style={S.card}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                        {['Client', 'Case No.', 'Court', 'Next Date'].map(h => <th key={h} style={{ padding: 12, textAlign: 'left', fontSize: 10, color: '#475569', textTransform: 'uppercase' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <td style={{ padding: 12 }}>{c.name}</td>
                          <td style={{ padding: 12 }}><span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-xs">{c.case_number}</span></td>
                          <td style={{ padding: 12, color: '#64748b' }}>{c.court}</td>
                          <td style={{ padding: 12, color: '#10b981' }}>{c.next_date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* KNOWLEDGE BASE */}
            {view === 'knowledge-base' && (
              <motion.div key="kb" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', overflowY: 'auto', padding: 28 }}>
                <h2 style={{ fontSize: 36, fontWeight: 900, fontStyle: 'italic', margin: '0 0 24px' }}>Law Knowledge Base</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {kbDocs.map(doc => (
                    <div key={doc.id} style={{ background: '#0a0f1d', borderRadius: 18, padding: 20, border: '1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{doc.name}</div>
                      <div style={{ fontSize: 10, color: '#475569' }}>{doc.size} · {doc.pages} pages</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* TEMP INSTRUCTIONS */}
            {view === 'temp-instructions' && (
              <motion.div key="instr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', padding: 24 }}>
                <h2 style={{ fontSize: 28, fontWeight: 900, fontStyle: 'italic', marginBottom: 20 }}>Temporary Instructions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tempInstructions.map(instr => (
                    <div key={instr.id} style={{ ...S.card, padding: 16 }}>
                      <p style={{ margin: 0, fontSize: 13 }}>{instr.text}</p>
                    </div>
                  ))}
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
              <motion.div key="support" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24 }}>
                <h2 style={{ fontSize: 26, fontWeight: 900, fontStyle: 'italic', marginBottom: 20 }}>Help Desk</h2>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {supportMsgs.map(msg => (
                    <div key={msg.id} style={{ maxWidth: '80%', padding: 12, borderRadius: 12, background: msg.role === 'ai' ? 'rgba(255,255,255,.03)' : 'rgba(99,102,241,.1)' }}>
                      <p style={{ margin: 0, fontSize: 13 }}>{msg.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* READING ROOM */}
            {view === 'reading-room' && (
              <motion.div key="reading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#070b14' }}>
                <div style={{ flex: 1, display: 'flex', gap: 18, padding: 18 }}>
                  <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: '#0a0f1d', borderRadius: 22, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden', position: 'relative', minHeight: 300 }}>
                      <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: scanPhase === 'live' ? 'block' : 'none' }} />
                      <canvas ref={canvasRef} style={{ display: 'none' }} />
                      {scanPhase === 'idle' && <div className="absolute inset-0 flex items-center justify-center text-slate-500">Camera is off</div>}
                      {scanPhase === 'live' && <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold uppercase animate-pulse">Live</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {scanPhase === 'idle' ? (
                        <button onClick={startScan} style={{ flex: 1, padding: 12, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 12, color: '#10b981', fontWeight: 900 }}>Start Camera</button>
                      ) : (
                        <button onClick={captureScan} style={{ flex: 1, padding: 12, background: '#10b981', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 900 }}>Capture & Read</button>
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
                        {isConverting ? 'Translating...' : 'Translate (Sarvam)'}
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
              <motion.div key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', overflow: 'hidden', background: '#020617' }}>
                
                {/* Column 1: Advocate Inputs */}
                <div style={{ 
                  width: maximizedColumn === 'inputs' ? '100%' : (maximizedColumn === 'none' ? 350 : 0), 
                  display: (maximizedColumn === 'none' || maximizedColumn === 'inputs') ? 'flex' : 'none',
                  borderRight: '1px solid rgba(255,255,255,.05)', 
                  flexDirection: 'column', 
                  background: '#070b14',
                  transition: 'all 0.3s ease'
                }}>
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
                    {/* Temporary Writing Pad */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Temporary Writing Pad</label>
                        <button onClick={() => setWritingPad('')} style={{ fontSize: 8, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                      </div>
                      <textarea 
                        value={writingPad} 
                        onChange={e => setWritingPad(e.target.value)}
                        placeholder="Free notes, quick points..."
                        style={{ width: '100%', height: 120, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 12, fontSize: 12, resize: 'none', lineHeight: 1.6 }}
                      />
                    </div>

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
                        placeholder="Describe the client's story/facts..."
                        style={{ width: '100%', height: 180, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 12, fontSize: 12, resize: 'none', lineHeight: 1.6 }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => {
                            setNotifications(prev => [{ id: Date.now(), message: "Facts saved to local session.", date: new Date().toISOString().split('T')[0], read: false, type: 'success' }, ...prev]);
                            getAiGuidance();
                          }}
                          style={{ flex: 1, padding: '8px', background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, color: '#6366f1', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          <Save size={12} /> Save & Get Guidance
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
                  </div>

                  <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <button 
                      onClick={generateDraft}
                      disabled={deskLoading}
                      style={{ width: '100%', padding: '14px', background: '#f59e0b', border: 'none', borderRadius: 12, color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: deskLoading ? 0.5 : 1 }}
                    >
                      {deskLoading ? <RotateCcw size={16} className="spin" /> : <Zap size={16} />}
                      Generate Draft (Sarvam)
                    </button>
                  </div>
                </div>

                {/* Column 2: Draft Editor */}
                <div style={{ 
                  flex: 1, 
                  display: (maximizedColumn === 'none' || maximizedColumn === 'editor') ? 'flex' : 'none', 
                  flexDirection: 'column', 
                  borderRight: '1px solid rgba(255,255,255,.05)',
                  transition: 'all 0.3s ease'
                }}>
                  <div style={{ height: 48, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={14} className="text-indigo-500" />
                      <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase' }}>Legal Draft Editor</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button 
                        onClick={() => setMaximizedColumn(maximizedColumn === 'editor' ? 'none' : 'editor')}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#cbd5e1', fontSize: 10, fontWeight: 900 }}
                        title={maximizedColumn === 'editor' ? "Minimize" : "Enlarge"}
                      >
                        {maximizedColumn === 'editor' ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                        {maximizedColumn === 'editor' ? 'Minimize' : 'Enlarge'}
                      </button>
                      <button onClick={handleDownloadDraft} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#cbd5e1', fontSize: 10, fontWeight: 900 }}>
                        <Download size={12} /> Download
                      </button>
                      <button onClick={() => setDraftEditMode(!draftEditMode)} style={{ padding: '6px 12px', background: draftEditMode ? '#f59e0b' : 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, color: draftEditMode ? '#000' : '#f59e0b', fontSize: 10, fontWeight: 900 }}>
                        {draftEditMode ? 'Save' : 'Edit'}
                      </button>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: '#0d1117', padding: 40, overflowY: 'auto', position: 'relative' }}>
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
                <div style={{ 
                  width: maximizedColumn === 'assistant' ? '100%' : (maximizedColumn === 'none' ? 320 : 0), 
                  display: (maximizedColumn === 'none' || maximizedColumn === 'assistant') ? 'flex' : 'none',
                  background: '#070b14', 
                  flexDirection: 'column',
                  transition: 'all 0.3s ease'
                }}>
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

                    {/* Suggestions (Gemini) */}
                    {aiSuggestions.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>Draft Suggestions</div>
                        {aiSuggestions.map((s, i) => (
                          <div key={i} style={{ padding: 12, background: 'rgba(245,158,11,.05)', border: '1px solid rgba(245,158,11,.1)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>{s}</div>
                            <button 
                              onClick={() => integrateSuggestion(s)}
                              style={{ alignSelf: 'flex-end', padding: '4px 8px', background: 'rgba(245,158,11,.2)', border: 'none', borderRadius: 6, color: '#f59e0b', fontSize: 9, fontWeight: 900, cursor: 'pointer' }}
                            >
                              Approve & Integrate
                            </button>
                          </div>
                        ))}
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
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} style={{ background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 24, padding: '12px 20px', minWidth: 280, boxShadow: '0 20px 50px rgba(0,0,0,.5)' }}>
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
                    <div className="markdown-body" style={{ fontSize: 11, marginTop: 8, paddingRight: 24 }}>
                      <ReactMarkdown>{voiceAiReply}</ReactMarkdown>
                    </div>
                    <button onClick={() => speakResponse(voiceAiReply)} style={{ position: 'absolute', top: 8, right: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                      <Volume2 size={14} />
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
                  <span style={{ fontSize: 8, color: '#475569', fontWeight: 900, textTransform: 'uppercase' }}>
                    Engine: {activeEngine || (isOffline || aiStatus.offlineBrain ? 'Gemma 3' : aiStatus.builtIn ? 'Gemini Nano' : 'Gemini 3 Flash')}
                  </span>
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
              onClick={toggleVoiceAi} 
              style={{ width: 56, height: 56, borderRadius: '50%', background: voiceAiOn ? '#ef4444' : '#6366f1', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', cursor: 'pointer' }}
            >
              {voiceAiOn ? <Square size={24} fill="#fff" /> : <Mic size={24} />}
            </motion.button>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Nexus Link</div>
              <div style={{ fontSize: 8, color: voiceAiListening ? '#ef4444' : voiceAiThinking ? '#6366f1' : voiceAiOn ? '#10b981' : '#475569', fontWeight: 700 }}>
                {voiceAiListening ? '● LISTENING...' : voiceAiThinking ? '● THINKING...' : voiceAiOn ? '● ACTIVE' : 'STANDBY'}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* --- ONBOARDING MODAL --- */}
      {showOnboarding && (
        <div className="absolute inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[40px] p-10 max-w-xl w-full">
            <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center mb-8"><span className="text-4xl font-black italic text-black">N</span></div>
            <h2 className="text-4xl font-black italic tracking-tighter mb-4">Welcome to <span className="text-indigo-500">Nexus Hybrid</span></h2>
            <p className="text-slate-400 mb-8 leading-relaxed">Please ensure your <strong className="text-white">Chrome Browser is updated</strong> for the best AI experience.</p>
            <div className="space-y-4 mb-10">
              <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${aiStatus.builtIn ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{aiStatus.builtIn ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}</div>
                <div className="flex-1"><div className="text-sm font-bold">{aiStatus.builtIn ? 'Built-in AI Detected' : 'Chrome Update Recommended'}</div><div className="text-xs text-slate-500">{aiStatus.builtIn ? 'Zero-download AI is ready.' : 'Update Chrome to enable zero-download AI.'}</div></div>
              </div>
            </div>
            <button onClick={() => { localStorage.setItem('onboarding_complete', 'true'); setShowOnboarding(false); }} className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase tracking-widest">Enter Portal</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
