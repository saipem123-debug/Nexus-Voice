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
    this.updateStatus();
    this.init();
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
      model: "gemini-3.1-flash-live-preview",
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are the primary AI Orchestrator (Gemini 3.1 Flash-Live) for Nexus Justice. You handle all voice interactions and vision-based legal assistance in real-time. You are professional, authoritative, and helpful. You can see through the advocate's camera and hear their voice. Your goal is to provide a seamless, real-time experience for the advocate.",
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
      this.geminiReady = response.data.geminiConfigured || !!this.genAI;
    } catch (e) {
      console.warn("Failed to fetch AI status from backend");
    }
  }

  public static getInstance(): HybridAIEngine {
    if (!HybridAIEngine.instance) {
      HybridAIEngine.instance = new HybridAIEngine();
    }
    return HybridAIEngine.instance;
  }

  private async callGemini(prompt: string, history: AIMessage[], imageBase64?: string, signal?: AbortSignal): Promise<string | null> {
    // Refresh token before calling if using OAuth
    if (this.accessToken) {
      await this.refreshAccessToken();
    }
    
    if (!this.genAI) return null;
    try {
      if (signal?.aborted) return null;
      console.log("Calling Gemini 2.5 Flash-Live Orchestrator with Web Search...");
      
      const sanitizedHistory: any[] = [];
      let lastRole = '';
      
      const historyToProcess = history.filter(m => m.content !== prompt || m !== history[history.length - 1]);

      for (const m of historyToProcess) {
        const role = m.role === 'assistant' ? 'model' : 'user';
        if (role === lastRole) continue; 
        sanitizedHistory.push({
          role,
          parts: [{ text: m.content }]
        });
        lastRole = role;
      }

      if (lastRole === 'user' && sanitizedHistory.length > 0) {
        sanitizedHistory.pop();
      }

      const contents = [
        ...sanitizedHistory,
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...(imageBase64 ? [{
              inlineData: {
                mimeType: "image/jpeg",
                data: imageBase64.split(',')[1]
              }
            }] : [])
          ]
        }
      ];

      // @ts-ignore
      const response = await this.genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are the primary AI Orchestrator (Gemini 3 Flash) for Nexus Justice. You handle all voice interactions, phone calls to clients, and direct communication with the advocate. You are professional, authoritative, and helpful. You have access to Google Search for real-time information and legal research. Your goal is to provide a seamless, high-performance experience for the advocate.",
          tools: [{ googleSearch: {} }]
        },
        // @ts-ignore
        contents: contents
      });
      
      console.log("Gemini Orchestrator responded.");
      return response.text || null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log("Gemini request aborted.");
        return null;
      }
      console.error("Gemini failed:", err);
      return null;
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

      onStatusUpdate?.("Orchestrating task...");
      await this.updateStatus();

      const canUseOnline = navigator.onLine;
      
      if (!canUseOnline) {
        return { text: "Nexus Justice: You are currently offline. Please reconnect to use the AI Orchestrator.", engine: 'None' };
      }

      // Use Gemini 2.5 Flash-Live Orchestrator
      if (this.geminiReady) {
        onStatusUpdate?.("Consulting Gemini 2.5 Flash-Live...");
        const geminiResponse = await this.callGemini(prompt, history, imageBase64, signal);
        if (geminiResponse) {
          return { text: geminiResponse, engine: 'Gemini 2.5 Flash' };
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
