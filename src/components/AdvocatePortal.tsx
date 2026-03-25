import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Mic, Camera, FileText, Users, Bell, HelpCircle, 
  BookOpen, Edit3, Layout, MessageSquare, Settings, 
  Download, Globe, Wifi, WifiOff, Shield, Save, Trash2,
  ChevronLeft, ChevronRight, Play, Square, Copy, ExternalLink,
  CheckCircle, AlertTriangle, Info, X, Search, Plus, RotateCcw,
  Volume2, Send, Trash, Check, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from 'react-markdown';
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

  // AI Engine & DB
  const aiEngine = HybridAIEngine.getInstance();
  const localDB = LocalDB.getInstance();

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
    { role: 'ai', text: "Welcome to the Writing Desk. I can help you draft petitions and plaints. Use the AI chat on the right for suggestions." }
  ]);

  // Voice AI Dock
  const [voiceAiOn, setVoiceAiOn] = useState(false);
  const [voiceAiListening, setVoiceAiListening] = useState(false);
  const [voiceAiThinking, setVoiceAiThinking] = useState(false);
  const [voiceAiSpeaking, setVoiceAiSpeaking] = useState(false);
  const [voiceAiTranscript, setVoiceAiTranscript] = useState('');
  const [voiceAiReply, setVoiceAiReply] = useState('');
  const [camOn, setCamOn] = useState(false);
  const recognitionRef = useRef<any>(null);

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

  // --- Initialization ---
  useEffect(() => {
    const init = async () => {
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
      
      setAiStatus(aiEngine.getStatus());
      if (localStorage.getItem('onboarding_complete')) setShowOnboarding(false);
    };
    init();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- AI Logic ---
  const sendConsult = async (initialText?: string) => {
    const text = initialText || consoleInput.trim();
    if (!text || consoleLoading) return;
    if (!initialText) setConsoleInput("");
    setChatHistory(prev => [...prev, { role: 'user', content: text }]);
    setConsoleLoading(true);

    try {
      const response = await aiEngine.generateResponse(text, chatHistory);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      console.error(err);
    } finally {
      setConsoleLoading(false);
    }
  };

  const sendDeskChat = async () => {
    if (!deskInput.trim() || deskLoading) return;
    const text = deskInput.trim();
    setDeskInput("");
    setDeskChatHistory(prev => [...prev, { role: 'user', text }]);
    setDeskLoading(true);

    try {
      const response = await aiEngine.generateResponse(text, []);
      setDeskChatHistory(prev => [...prev, { role: 'ai', text: response }]);
    } catch (err) {
      console.error(err);
    } finally {
      setDeskLoading(false);
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
    const aiResponse = `Hello, this is the AI Assistant for Advocate. Regarding your call: ${instructions || "The advocate is currently busy, but I can take a message or provide basic guidance based on your previous cases."}`;
    
    const updatedCall = {
      ...call,
      duration: "45s",
      transcript: [
        { role: "client", text: "Hello? Is the advocate there?" },
        { role: "ai", text: aiResponse }
      ],
      summary: "AI Auto-Answered: Provided temporary instructions to client."
    };

    setTimeout(() => {
      setIncomingCall(null);
      setIsAnswering(false);
      setNotifications(prev => [{
        id: Date.now(),
        message: `AI Auto-Answered a call from ${call.clientName}. Check logs for details.`,
        date: new Date().toISOString().split('T')[0],
        read: false,
        type: 'call'
      }, ...prev]);
      // In a real app, we'd add to SIMULATED_CALLS or DB
    }, 4000);
  };

  // --- Camera / OCR Logic ---
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
    setScanPhase('processing'); setScanProgress(20);
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const imageBase64 = canvasRef.current.toDataURL('image/jpeg');
    
    setScanProgress(40);
    try {
      const response = await aiEngine.generateResponse(
        "Please extract all the text from this legal document and summarize its key points.", 
        [], 
        imageBase64
      );
      setScannedText(response);
      setScanPhase('done');
      setScanProgress(100);
    } catch (err) {
      setScanError('AI analysis failed.');
      setScanPhase('error');
    } finally {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }
  };

  // --- Voice AI Logic ---
  const startVoiceAi = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setVoiceAiListening(true);
      setVoiceAiTranscript('');
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      setVoiceAiTranscript(transcript);
    };

    recognition.onend = async () => {
      setVoiceAiListening(false);
      if (voiceAiTranscript.trim()) {
        processVoiceCommand(voiceAiTranscript);
      } else if (voiceAiOn) {
        // Restart if still on but no transcript
        // recognition.start(); 
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setVoiceAiListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [voiceAiTranscript, voiceAiOn]);

  const processVoiceCommand = async (text: string) => {
    setVoiceAiThinking(true);
    try {
      let imageBase64 = undefined;
      if (camOn && videoRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
        imageBase64 = canvas.toDataURL('image/jpeg');
      }

      const response = await aiEngine.generateResponse(text, [], imageBase64);
      setVoiceAiReply(response);
      speakResponse(response);
    } catch (err) {
      console.error(err);
    } finally {
      setVoiceAiThinking(false);
    }
  };

  const speakResponse = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setVoiceAiSpeaking(true);
    utterance.onend = () => {
      setVoiceAiSpeaking(false);
      if (voiceAiOn) {
        // Optionally restart listening
      }
    };
    window.speechSynthesis.speak(utterance);
  };

  const stopVoiceAi = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    window.speechSynthesis.cancel();
    setVoiceAiOn(false);
    setVoiceAiListening(false);
    setVoiceAiSpeaking(false);
  };

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
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(99,102,241,.4);border-radius:4px}
        input,textarea,select{color:#e2e8f0;outline:none}
        input::placeholder,textarea::placeholder{color:#475569}
        .tab-scroll::-webkit-scrollbar{display:none}
        button:focus{outline:none}
        .kb-drop{border:2px dashed rgba(99,102,241,.3);border-radius:20px;transition:all .2s}
        .kb-drop.over{border-color:#6366f1;background:rgba(99,102,241,.05)}
        .instr-card{transition:all .2s}
        .instr-card:hover{border-color:rgba(245,158,11,.2)!important}
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
              isOffline ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {isOffline ? <WifiOff size={12} /> : <Wifi size={12} />}
              {isOffline ? 'Offline Mode' : 'Cloud Active'}
            </div>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ padding: '4px 12px', background: 'rgba(255,255,255,.05)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-a" style={{ width: 6, height: 6, borderRadius: '50%', background: aiStatus.builtIn ? '#10b981' : '#6366f1', display: 'inline-block' }} />
              <span style={{ fontSize: 9, fontWeight: 900, color: aiStatus.builtIn ? '#10b981' : '#6366f1', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {aiStatus.builtIn ? 'Chrome AI Ready' : 'Sarvam 30B Active'}
              </span>
            </div>
          </div>
        </header>

        {/* Tab bar (Upside Menus) */}
        <div style={{ background: '#070b14', borderBottom: '1px solid rgba(255,255,255,.05)', flexShrink: 0, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <div className="tab-scroll" style={{ flex: 1, display: 'flex', gap: 0, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 4px' }}>
            {sideNav.map(item => (
              <button key={item.id} onClick={() => setView(item.id)}
                style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: view === item.id ? '2px solid #6366f1' : '2px solid transparent', color: view === item.id ? '#6366f1' : '#475569', fontSize: 10, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color .2s', flexShrink: 0 }}>
                {item.label}
              </button>
            ))}
          </div>
        </div>

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
                        <button style={{ flex: 1, padding: '8px 0', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#94a3b8', fontSize: 10, fontWeight: 900 }}>Config</button>
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

                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, marginBottom: 16 }}>
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} style={{ flex: 1, borderRadius: 2, background: `rgba(245,158,11,${0.2 + Math.random() * 0.6})`, height: `${20 + Math.random() * 70}%`, animation: `waveBar ${0.4 + Math.random() * 0.5}s ease-in-out ${i * 0.06}s infinite alternate` }} />
                      ))}
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
                        <div style={{ maxWidth: '80%', padding: '13px 17px', borderRadius: 20, background: msg.role === 'user' ? 'rgba(99,102,241,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,.3)' : 'rgba(255,255,255,.07)'}`, fontSize: 13, lineHeight: 1.7 }}>
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {consoleLoading && <div className="flex gap-2 p-4"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" /><div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" /></div>}
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input value={consoleInput} onChange={e => setConsoleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendConsult()} placeholder="Ask anything legal..." style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '13px 18px' }} />
                    <button onClick={() => sendConsult()} style={{ padding: '13px 22px', background: '#6366f1', border: 'none', borderRadius: 14, color: '#fff', fontWeight: 900 }}>Send</button>
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
                    <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, color: '#94a3b8', lineHeight: 1.8, fontFamily: 'monospace' }}>{scannedText || "Capture a document to see text..."}</div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* DOC CONVERTER */}
            {view === 'doc-converter' && (
              <motion.div key="converter" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', padding: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 900, fontStyle: 'italic', marginBottom: 20 }}>Document Converter</h2>
                <div style={S.card}>
                  <p style={{ color: '#475569' }}>Multi-page scanning and conversion tools.</p>
                </div>
              </motion.div>
            )}

            {/* WRITING DESK */}
            {view === 'writing-desk' && (
              <motion.div key="writing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ height: 48, background: '#0a0f1d', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1' }}>Page {currentPage}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setDraftEditMode(!draftEditMode)} style={{ padding: '4px 10px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, color: '#f59e0b', fontSize: 10, fontWeight: 900 }}>Edit</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, background: '#0d1117', padding: 40, overflowY: 'auto' }}>
                    <pre style={{ fontFamily: "'Courier New', monospace", fontSize: 13, lineHeight: 1.8, color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{draftPages[0]}</pre>
                  </div>
                </div>
                <div style={{ width: 320, background: '#070b14', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                    <h3 style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase' }}>AI Drafting Assistant</h3>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {deskChatHistory.map((msg, i) => (
                      <div key={i} style={{ padding: 12, borderRadius: 12, background: msg.role === 'ai' ? 'rgba(255,255,255,.03)' : 'rgba(99,102,241,.1)', border: '1px solid rgba(255,255,255,.05)' }}>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{msg.text}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,.05)' }}>
                    <input value={deskInput} onChange={e => setDeskInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendDeskChat()} placeholder="Ask AI to draft..." style={{ width: '100%', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 10, fontSize: 12 }} />
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
                  <div className="flex gap-1">
                    {[0,1,2].map(i => <div key={i} style={{ width: 3, height: 12, background: '#6366f1', borderRadius: 2, animation: `waveBar 0.5s ease-in-out ${i*0.1}s infinite alternate` }} />)}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {voiceAiListening ? 'Listening...' : 'Nexus AI Ready'}
                  </span>
                </div>
                {voiceAiTranscript && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' }}>"{voiceAiTranscript}"</div>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Dock Pill */}
          <div style={{ background: 'rgba(0,0,0,.9)', backdropFilter: 'blur(20px)', padding: '12px 24px', borderRadius: 40, border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,.8)' }}>
            <button onClick={() => { setCamOn(!camOn); setView('reading-room'); if(!camOn) startScan(); }} style={{ width: 48, height: 48, borderRadius: '50%', background: camOn ? '#6366f1' : 'rgba(255,255,255,.05)', border: 'none', color: camOn ? '#fff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
              <Camera size={20} />
            </button>
            <button onClick={() => { 
              if (voiceAiOn) {
                stopVoiceAi();
              } else {
                setVoiceAiOn(true);
                startVoiceAi();
              }
            }} style={{ width: 56, height: 56, borderRadius: '50%', background: voiceAiOn ? '#ef4444' : '#6366f1', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', transform: voiceAiOn ? 'scale(1.1)' : 'scale(1)' }}>
              <Mic size={24} />
            </button>
            <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.1)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Nexus Link</div>
              <div style={{ fontSize: 8, color: voiceAiOn ? '#10b981' : '#475569', fontWeight: 700 }}>{voiceAiOn ? '● ONLINE' : 'OFFLINE'}</div>
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
