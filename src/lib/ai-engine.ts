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
    // Ensure we have a valid token/key
    if (!this.accessToken && !this.genAI) {
      this.loadStaticApiKey();
    }
    
    try {
      if (signal?.aborted) return null;
      
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

      const systemInstruction = "You are the primary AI Orchestrator for Nexus Justice. You handle legal research, drafting, and consultation. You are professional and authoritative.";

      // 1. If we have an OAuth access token, use the REST API directly from the client
      if (this.accessToken) {
        console.log("Calling Gemini REST API directly from client with OAuth token...");
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent`;
        
        try {
          const response = await axios.post(url, {
            contents: contents,
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            tools: [{ googleSearch: {} }]
          }, {
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json'
            },
            signal,
            timeout: 30000
          });
          
          console.log("Direct REST API call successful.");
          return response.data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        } catch (restErr: any) {
          console.error("Direct REST API call failed:", restErr.response?.data || restErr.message);
          
          // If CORS or other direct call issue, fallback to server proxy as a last resort
          console.log("Falling back to server proxy due to direct call failure...");
          const proxyResponse = await axios.post('/api/ai/generate', {
            prompt,
            history,
            imageBase64,
            systemInstruction
          }, { signal, timeout: 30000 });
          
          return proxyResponse.data.text || proxyResponse.data.error || null;
        }
      }

      // 2. If we have a direct API key, use the SDK
      if (this.genAI) {
        console.log("Calling Gemini SDK directly from client with API key...");
        // @ts-ignore
        const response = await this.genAI.models.generateContent({
          model: "gemini-3-flash-preview",
          config: {
            systemInstruction,
            tools: [{ googleSearch: {} }]
          },
          // @ts-ignore
          contents: contents
        });
        
        console.log("Direct SDK call successful.");
        return response.text || null;
      }
    } catch (err: any) {
      if (err instanceof Error && err.name === 'AbortError') return null;
      console.error("Direct Gemini call failed:", err.response?.data || err.message || err);
      
      const errorDetail = err.response?.data?.error?.message || err.message || "Unknown error";
      return `AI Error: ${errorDetail}`;
    }

    return null;
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

      // Use Gemini 3 Flash Orchestrator
      if (this.geminiReady) {
        onStatusUpdate?.("Consulting Gemini 3 Flash...");
        const geminiResponse = await this.callGemini(prompt, history, imageBase64, signal);
        if (geminiResponse) {
          return { text: geminiResponse, engine: 'Gemini 3 Flash' };
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
