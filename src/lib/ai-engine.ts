import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { pipeline, env } from '@huggingface/transformers';
import Tesseract from 'tesseract.js';
import { LocalDB } from './local-db';

// Configure Transformers.js to use local cache if possible
env.allowLocalModels = false;
env.useBrowserCache = true;

export type AIMessage = {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  engine?: string;
};

export class HybridAIEngine {
  private static instance: HybridAIEngine;
  private genAI: GoogleGenAI | null = null;

  private sarvamReady: boolean = false;
  private geminiReady: boolean = false;

  private constructor() {
    this.updateStatus();
    this.loadApiKey();
  }

  private loadApiKey() {
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
      this.sarvamReady = response.data.sarvamConfigured;
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

  private isSarvamTask(prompt: string): boolean {
    const sarvamKeywords = [
      'search', 'web', 'internet', 'legal doubt', 'research', 'translate', 
      'malayalam', 'hindi', 'tamil', 'telugu', 'kannada', 'marathi', 'bengali',
      'draft', 'writing', 'petition', 'plaint', 'affidavit', 'contract', 'agreement',
      'legal advice', 'legal opinion'
    ];
    const lowerPrompt = prompt.toLowerCase();
    return sarvamKeywords.some(keyword => lowerPrompt.includes(keyword));
  }

  private async callSarvam(prompt: string, history: AIMessage[], signal?: AbortSignal): Promise<string | null> {
    try {
      if (signal?.aborted) return null;
      console.log("Calling Sarvam AI for specialized task...");
      const response = await axios.post('/api/ai/sarvam', {
        prompt,
        history: history.map(m => ({ role: m.role, content: m.content }))
      }, { signal, timeout: 45000 });
      console.log("Sarvam AI responded.");
      return response.data.choices[0].message.content;
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log("Sarvam AI request cancelled.");
        return null;
      }
      console.error("Sarvam AI failed:", err);
      return null;
    }
  }

  public async sarvamTTS(text: string): Promise<string | null> {
    try {
      console.log("Calling Sarvam TTS (Bulbul V3)...");
      const response = await axios.post('/api/ai/sarvam/tts', { text });
      return response.data.audios?.[0] || null;
    } catch (err) {
      console.error("Sarvam TTS failed:", err);
      return null;
    }
  }

  public async sarvamSTT(audioBase64: string): Promise<string | null> {
    try {
      console.log("Calling Sarvam STT (Saaras V3)...");
      const response = await axios.post('/api/ai/sarvam/stt', { audio_content: audioBase64 });
      return response.data.transcript || null;
    } catch (err) {
      console.error("Sarvam STT failed:", err);
      return null;
    }
  }

  public async sarvamVision(prompt: string, imageBase64: string): Promise<string | null> {
    try {
      console.log("Calling Sarvam Vision...");
      const response = await axios.post('/api/ai/sarvam/vision', { prompt, imageBase64 });
      return response.data.text || null;
    } catch (err) {
      console.error("Sarvam Vision failed:", err);
      return null;
    }
  }

  public async sarvamTranslate(input: string, targetLang: string, sourceLang: string = "en-IN"): Promise<string | null> {
    try {
      console.log(`Calling Sarvam Translation (${sourceLang} -> ${targetLang})...`);
      const response = await axios.post('/api/ai/sarvam/translate', {
        input,
        target_language_code: targetLang,
        source_language_code: sourceLang
      });
      return response.data.translated_text || null;
    } catch (err) {
      console.error("Sarvam Translation failed:", err);
      return null;
    }
  }

  private async callGemini(prompt: string, history: AIMessage[], imageBase64?: string, signal?: AbortSignal): Promise<string | null> {
    if (!this.genAI) return null;
    try {
      if (signal?.aborted) return null;
      console.log("Calling Gemini 2.5 Flash-Live Orchestrator...");
      
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
        model: "gemini-2.5-flash-preview",
        config: {
          systemInstruction: "You are the primary AI Orchestrator (Gemini 2.5 Flash-Live) for Nexus Justice. You handle all voice interactions, phone calls to clients, and direct communication with the advocate. You are professional, authoritative, and helpful. For tasks involving web search, deep legal research, complex drafting, or translation, you delegate to Sarvam AI. Your goal is to provide a seamless, high-performance experience for the advocate.",
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
    forcedEngine?: 'sarvam' | 'gemini',
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

      const useSarvam = this.isSarvamTask(prompt) || forcedEngine === 'sarvam';
      const canUseOnline = navigator.onLine;
      
      if (!canUseOnline) {
        return { text: "Nexus Justice: You are currently offline. Please reconnect to use the AI Orchestrator.", engine: 'None' };
      }

      // 1. Delegate to Sarvam if it's a Sarvam task (Drafting, Translation, Web Search, Legal Doubts)
      if (useSarvam && this.sarvamReady) {
        onStatusUpdate?.("Delegating to Sarvam AI...");
        const sarvamResponse = await this.callSarvam(prompt, history, signal);
        if (sarvamResponse) {
          return { text: sarvamResponse, engine: 'Sarvam AI' };
        }
      }

      // 2. Otherwise, use Gemini 2.5 Flash-Live Orchestrator
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
      sarvamReady: this.sarvamReady,
      geminiReady: this.geminiReady
    };
  }
}
