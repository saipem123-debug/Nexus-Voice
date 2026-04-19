import axios from 'axios';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import Tesseract from 'tesseract.js';
import { LocalDB } from './local-db';

export type AIMessage = {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  engine?: string;
};

export class HybridAIEngine {
  private static instance: HybridAIEngine;
  private genAI: GoogleGenAI | null = null;
  private accessToken: string | null = null;
  private geminiReady: boolean = false;

  private constructor() {
    // Synchronous check for local key to avoid "Offline" flicker
    try {
      const localDB = LocalDB.getInstance();
      const config = localDB.query("SELECT value FROM config WHERE key = 'gemini_api_key'");
      if (config.length > 0 && config[0].value) {
        this.geminiReady = true;
      }
    } catch (e) {}

    this.init().then(() => {
      this.updateStatus(true);
    });
  }

  private async init() {
    await this.refreshAccessToken();
  }

  private async refreshAccessToken() {
    try {
      const response = await axios.get('/api/ai/token');
      this.accessToken = response.data.accessToken;
      if (this.accessToken) {
        // Initialize with access token in custom headers
        this.genAI = new GoogleGenAI({ 
          apiKey: 'dummy-key', // Still need a placeholder for the SDK to not complain
          customHeaders: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        } as any);
        this.geminiReady = true;
      }
    } catch (err) {
      console.warn("Failed to fetch access token from backend. Falling back to static key if available.");
      this.loadStaticApiKey();
    }
  }

  private loadStaticApiKey() {
    const localDB = LocalDB.getInstance();
    const config = localDB.query("SELECT value FROM config WHERE key = 'gemini_api_key'");
    let apiKey = config.length > 0 ? config[0].value : null;

    if (!apiKey) {
      apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    }

    if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
      this.genAI = new GoogleGenAI({ apiKey });
      this.geminiReady = true;
    }
  }

  public setApiKey(apiKey: string) {
    const localDB = LocalDB.getInstance();
    localDB.run("INSERT OR REPLACE INTO config (key, value) VALUES ('gemini_api_key', ?)", [apiKey]);
    localStorage.setItem('nexus_gemini_api_key', 'true'); // Flag for quick check
    this.genAI = new GoogleGenAI({ apiKey });
    this.geminiReady = true;
  }

  private getRequestOptions() {
    if (this.accessToken) {
      return {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      };
    }
    return {};
  }

  public async connectLive(callbacks: {
    onopen?: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror?: (error: any) => void;
    onclose?: () => void;
  }) {
    if (!this.genAI) throw new Error("GenAI not initialized");
    
    // Refresh token before connecting if using OAuth
    if (this.accessToken) await this.refreshAccessToken();

    return this.genAI.live.connect({
      model: "gemini-2.5-flash-preview-04-17",
      callbacks,
      config: {
        generationConfig: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
        },
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
        systemInstruction: "You are the primary AI Orchestrator (Gemini 2.5 Flash-Live) for Nexus Justice. You handle all voice interactions and vision-based legal assistance in real-time. You are professional, authoritative, and helpful. You can see through the advocate's camera and hear their voice. Your goal is to provide a seamless, real-time experience for the advocate.",
      },
    });
  }

  private lastStatusUpdate: number = 0;

  public async performOCR(imageBase64: string, onProgress?: (percent: number) => void): Promise<string> {
    try {
      console.log("Starting OCR with Tesseract.js...");
      const result = await Tesseract.recognize(
        imageBase64,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              onProgress?.(Math.round(m.progress * 100));
            }
          }
        }
      );
      console.log("OCR completed successfully.");
      return result.data.text;
    } catch (err) {
      console.error("OCR failed:", err);
      throw new Error("Failed to scan document text.");
    }
  }

  public async updateStatus(force: boolean = false) {
    const now = Date.now();
    if (!force && now - this.lastStatusUpdate < 30000) return; 
    
    this.lastStatusUpdate = now;
    try {
      const response = await axios.get('/api/ai/status', { timeout: 5000 });
      // geminiReady is true if server has a key, OR if we have a client-side SDK instance, OR if we have an OAuth token
      this.geminiReady = response.data.geminiConfigured || !!this.genAI || !!this.accessToken;
    } catch (e) {
      console.warn("Failed to fetch AI status from backend");
      // Fallback: if we have local credentials, we are still ready
      this.geminiReady = !!this.genAI || !!this.accessToken;
    }
  }

  public static getInstance(): HybridAIEngine {
    if (!HybridAIEngine.instance) {
      HybridAIEngine.instance = new HybridAIEngine();
    }
    return HybridAIEngine.instance;
  }

  private async callGemini(prompt: string, history: AIMessage[], imageBase64?: string, signal?: AbortSignal): Promise<string | null> {
    try {
      const systemInstruction = "You are the primary AI Orchestrator for Nexus Justice. You handle legal research, drafting, and consultation. You are professional and authoritative.";

      // Get local API key if available to support unauthenticated BYOK
      const localDB = LocalDB.getInstance();
      const config = localDB.query("SELECT value FROM config WHERE key = 'gemini_api_key'");
      const localApiKey = config.length > 0 ? config[0].value : null;

      // Use server proxy for all calls to ensure reliability and bypass CORS/BYOK issues
      console.log("Calling Gemini via server proxy...");
      const proxyResponse = await axios.post('/api/ai/generate', {
        prompt,
        history,
        imageBase64,
        systemInstruction,
        apiKey: localApiKey
      }, { signal, timeout: 30000 });
      
      return proxyResponse.data.text || proxyResponse.data.error || null;
    } catch (error: any) {
      console.error("AI Engine Error:", error.response?.data || error.message);
      if (error.response?.status === 429 || (error.response?.data?.error?.message && error.response.data.error.message.includes("quota"))) {
        return "AI_ERROR_QUOTA_EXHAUSTED";
      }
      return `AI Error: ${error.response?.data?.error || error.message}`;
    }
  }

  public async generateResponse(
    prompt: string, 
    history: AIMessage[], 
    forcedEngine?: 'gemini',
    imageBase64?: string, 
    signal?: AbortSignal,
    onStatusUpdate?: (status: string) => void
  ): Promise<{ text: string, engine: string }> {
    const timeout = new Promise<{ text: string, engine: string }>((_, reject) => 
      setTimeout(() => reject(new Error("AI Engine Timeout")), 60000)
    );

    const execute = async (): Promise<{ text: string, engine: string }> => {
      if (signal?.aborted) throw new Error("Aborted");

      onStatusUpdate?.("Gemini is orchestrating...");
      await this.updateStatus();

      const canUseOnline = navigator.onLine;
      
      if (!canUseOnline) {
        return { text: "Nexus Justice: You are currently offline. Please reconnect to use the AI Orchestrator.", engine: 'None' };
      }

      // Use Gemini 2.5 Flash-Live Orchestrator
      if (this.geminiReady) {
        onStatusUpdate?.("Gemini 2.5 Flash-Live is consulting...");
        const geminiResponse = await this.callGemini(prompt, history, imageBase64, signal);
        if (geminiResponse === "AI_ERROR_QUOTA_EXHAUSTED") {
          throw new Error("QUOTA_EXHAUSTED");
        }
        if (geminiResponse) {
          return { text: geminiResponse, engine: 'Gemini 2.5 Flash-Live' };
        }
      }

      return { 
        text: "Nexus Justice: I am currently unable to reach the AI Orchestrator. Please check your connection or API key.", 
        engine: 'None' 
      };
    };

    return Promise.race([execute(), timeout]);
  }

  public getStatus() {
    this.updateStatus(); 
    return {
      online: navigator.onLine,
      geminiReady: this.geminiReady
    };
  }
}
