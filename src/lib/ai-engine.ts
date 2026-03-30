import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
import { pipeline, env } from '@huggingface/transformers';
import Tesseract from 'tesseract.js';

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
  private hasBuiltInAI: boolean = false;
  private builtInSession: any = null;
  private genAI: GoogleGenAI | null = null;

  private sarvamReady: boolean = false;
  private geminiReady: boolean = false;
  private ollamaReady: boolean = false;
  private transformersReady: boolean = false;
  private transformersPipeline: any = null;
  private transformersLoading: boolean = false;

  private constructor() {
    this.checkBuiltInAI();
    this.updateStatus();
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
      this.genAI = new GoogleGenAI({ apiKey });
    }
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
    if (!force && now - this.lastStatusUpdate < 30000) return; // Don't update more than once every 30s unless forced
    
    this.lastStatusUpdate = now;
    try {
      const response = await axios.get('/api/ai/status', { timeout: 5000 });
      this.sarvamReady = response.data.sarvamConfigured;
      this.geminiReady = response.data.geminiConfigured;
      
      // Also check Ollama readiness internally
      try {
        const res = await axios.get('http://localhost:11434/api/tags', { timeout: 2000 });
        const models = res.data.models || [];
        // Be more flexible with model names
        this.ollamaReady = models.some((m: any) => 
          m.name.toLowerCase().includes('gemma3') || 
          m.name.toLowerCase().includes('gemma:2b') ||
          m.name.toLowerCase().includes('gemma:7b')
        );
      } catch (e) {
        this.ollamaReady = false;
      }
    } catch (e) {
      console.warn("Failed to fetch AI status from backend");
    }
  }

  public async initTransformers() {
    if (this.transformersReady || this.transformersLoading) return;
    this.transformersLoading = true;
    try {
      console.log("Initializing Transformers.js (this may take a while for the first time)...");
      // Switching to a non-gated, highly reliable model for browser-side AI
      // @ts-ignore
      this.transformersPipeline = await pipeline('text-generation', 'onnx-community/Phi-3-mini-4k-instruct-onnx-web', {
        device: 'webgpu', // Try WebGPU first
      }).catch(async () => {
        console.warn("WebGPU initialization failed, falling back to WASM...");
        // Fallback to WASM if WebGPU is not available or fails
        // @ts-ignore
        return await pipeline('text-generation', 'onnx-community/Phi-3-mini-4k-instruct-onnx-web', {
          device: 'wasm',
        });
      });
      
      this.transformersReady = true;
      console.log("Transformers.js initialized successfully.");
    } catch (err) {
      console.error("Failed to initialize Transformers.js:", err);
      this.transformersReady = false;
    } finally {
      this.transformersLoading = false;
    }
  }

  public static getInstance(): HybridAIEngine {
    if (!HybridAIEngine.instance) {
      HybridAIEngine.instance = new HybridAIEngine();
    }
    return HybridAIEngine.instance;
  }

  private async checkBuiltInAI() {
    // @ts-ignore
    if (window.ai && window.ai.canCreateTextSession) {
      // @ts-ignore
      const canCreate = await window.ai.canCreateTextSession();
      if (canCreate !== 'no') {
        this.hasBuiltInAI = true;
      }
    }
  }

  private isComplexTask(prompt: string): boolean {
    const complexKeywords = [
      'draft', 'petition', 'research', 'complex', 'analysis', 'section', 
      'ipc', 'crpc', 'constitution', 'case law', 'precedent', 'legal opinion',
      'affidavit', 'contract', 'agreement', 'suit', 'appeal', 'writ',
      'advice', 'opinion', 'summary', 'extract', 'judgment', 'order', 'notice',
      'pleading', 'written statement', 'rejoinder', 'replication', 'vakalath',
      'power of attorney', 'will', 'deed', 'mortgage', 'lease', 'sale deed',
      'gift deed', 'partnership', 'company', 'registration', 'stamp duty',
      'court fee', 'limitation', 'jurisdiction', 'cause of action', 'relief',
      'prayer', 'verification', 'attestation', 'notary', 'commissioner',
      'evidence', 'witness', 'cross examination', 'chief examination',
      're-examination', 'exhibit', 'mark', 'certified copy', 'caveat',
      'stay', 'injunction', 'interim order', 'final order', 'decree',
      'execution', 'contempt', 'review', 'revision', 'reference',
      'special leave petition', 'slp', 'public interest litigation', 'pil'
    ];
    const lowerPrompt = prompt.toLowerCase();
    return complexKeywords.some(keyword => lowerPrompt.includes(keyword)) || prompt.length > 100;
  }

  private async callSarvam(prompt: string, history: AIMessage[], signal?: AbortSignal): Promise<string | null> {
    try {
      if (signal?.aborted) return null;
      console.log("Calling Sarvam AI...");
      const response = await axios.post('/api/ai/sarvam', {
        prompt,
        history: history.map(m => ({ role: m.role, content: m.content }))
      }, { signal, timeout: 30000 });
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

  private async callGemini(prompt: string, history: AIMessage[], imageBase64?: string, signal?: AbortSignal): Promise<string | null> {
    if (!this.genAI) return null;
    try {
      if (signal?.aborted) return null;
      console.log("Calling Gemini AI...");
      
      // Sanitize history for Gemini (no consecutive roles, no system role)
      const sanitizedHistory: any[] = [];
      let lastRole = '';
      
      // Filter out the current prompt if it's already at the end of history
      const historyToProcess = history.filter(m => m.content !== prompt || m !== history[history.length - 1]);

      for (const m of historyToProcess) {
        const role = m.role === 'assistant' ? 'model' : 'user';
        if (role === lastRole) continue; // Skip consecutive same roles
        sanitizedHistory.push({
          role,
          parts: [{ text: m.content }]
        });
        lastRole = role;
      }

      // Ensure we don't end with a 'user' role if we're about to add the prompt as 'user'
      if (lastRole === 'user' && sanitizedHistory.length > 0) {
        // We can't have two users in a row. We'll just merge them or skip the last one.
        // For now, let's just use the history as is and let the prompt be the final user message.
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
          systemInstruction: "You are the multimodal legal fallback for Nexus Justice, assisting the Gemma 3 Orchestrator. Provide concise, accurate legal guidance, especially for visual inputs or when the primary legal core is unavailable. The context is a professional advocate assisting a client.",
        },
        // @ts-ignore
        contents: contents
      });
      
      console.log("Gemini AI responded.");
      return response.text || null;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log("Gemini AI request aborted.");
        return null;
      }
      console.error("Gemini failed:", err);
      return null;
    }
  }

  private async callLocalOllama(prompt: string, history: AIMessage[], signal?: AbortSignal): Promise<string | null> {
    try {
      if (signal?.aborted) return null;
      console.log("Calling Local Ollama (Gemma 3)...");
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: "gemma3:1b", 
        messages: [
          { role: "system", content: "You are the Gemma 3 Orchestrator for Nexus Justice. Your role is to facilitate communication between the AI system and advocates, and to assist advocates when they are interacting with their clients, including during phone consultations. You are professional, authoritative, and helpful. You handle general queries directly and delegate complex legal research or drafting tasks to specialized engines when necessary." },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt }
        ],
        stream: false
      }, { 
        timeout: 30000,
        signal: signal
      });
      console.log("Local Ollama responded.");
      return response.data.message.content;
    } catch (err: any) {
      if (axios.isCancel(err)) {
        console.log("Local Ollama request cancelled.");
        return null;
      }
      if (err.response?.status === 404) {
        console.warn("Gemma 3 model not found in Ollama. Please pull it first.");
      } else {
        console.error("Local Ollama failed:", err);
      }
      return null;
    }
  }

  private async callTransformers(prompt: string, history: AIMessage[], signal?: AbortSignal): Promise<string | null> {
    if (!this.transformersReady || !this.transformersPipeline) return null;
    try {
      if (signal?.aborted) return null;
      console.log("Calling Transformers.js (Browser-side)...");
      
      const messages = [
        { role: "system", content: "You are the Gemma 3 Orchestrator for Nexus Justice. You are assisting an advocate locally in the browser." },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: prompt }
      ];

      const output = await this.transformersPipeline(messages, {
        max_new_tokens: 512,
        temperature: 0.7,
        do_sample: true,
        top_k: 50,
      });

      console.log("Transformers.js responded.");
      return output[0].generated_text[output[0].generated_text.length - 1].content;
    } catch (err) {
      console.error("Transformers.js failed:", err);
      return null;
    }
  }

  public async pullModel(onProgress: (percent: number) => void): Promise<void> {
    try {
      const response = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'gemma3:1b' }),
      });

      if (!response.ok) throw new Error('Failed to pull model from Ollama');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.total && json.completed) {
              const percent = Math.round((json.completed / json.total) * 100);
              onProgress(percent);
            } else if (json.status === 'success') {
              onProgress(100);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
      localStorage.setItem('offline_brain_installed', 'true');
    } catch (err) {
      console.error("Ollama pull failed:", err);
      throw err;
    }
  }

  public async generateResponse(
    prompt: string, 
    history: AIMessage[], 
    imageBase64?: string, 
    signal?: AbortSignal,
    onStatusUpdate?: (status: string) => void
  ): Promise<{ text: string, engine: string }> {
    const timeout = new Promise<{ text: string, engine: string }>((_, reject) => 
      setTimeout(() => reject(new Error("AI Engine Timeout")), 45000)
    );

    const execute = async (): Promise<{ text: string, engine: string }> => {
      if (signal?.aborted) throw new Error("Aborted");

      onStatusUpdate?.("Analyzing task...");
      // Ensure we have the latest status before deciding
      await this.updateStatus();

      const isComplex = this.isComplexTask(prompt) || !!imageBase64;
      const canUseOnline = navigator.onLine && (this.sarvamReady || this.geminiReady);
      
      console.log(`Gemma 3 Orchestrator analyzing task. Complex: ${isComplex}, Online: ${canUseOnline}, Ollama: ${this.ollamaReady}`);

      // 1. If NOT complex, prioritize local Gemma 3 (Ollama)
      if (!isComplex && this.ollamaReady) {
        onStatusUpdate?.("Consulting Local Gemma 3...");
        if (signal?.aborted) throw new Error("Aborted");
        const localGemma = await this.callLocalOllama(prompt, history, signal);
        if (localGemma) {
          return { text: localGemma, engine: 'Gemma 3 (Local via Ollama)' };
        }
      }

      // 2. If NOT complex, fallback to Browser AI (Transformers.js)
      if (!isComplex && this.transformersReady) {
        onStatusUpdate?.("Consulting Browser AI...");
        if (signal?.aborted) throw new Error("Aborted");
        const browserGemma = await this.callTransformers(prompt, history, signal);
        if (browserGemma) {
          return { text: browserGemma, engine: 'Gemma 3 (Browser via Transformers.js)' };
        }
      }

      // 3. If COMPLEX or Local failed/not ready, use Online Engines
      if (canUseOnline) {
        if (isComplex) {
          onStatusUpdate?.("Complex task detected. Consulting specialized legal engines...");
        } else {
          onStatusUpdate?.("Local brain not ready. Consulting cloud fallback...");
        }

        if (!imageBase64 && this.sarvamReady) {
          onStatusUpdate?.("Consulting Sarvam AI...");
          if (signal?.aborted) throw new Error("Aborted");
          const sarvamResponse = await this.callSarvam(prompt, history, signal);
          if (sarvamResponse) {
            return { text: sarvamResponse, engine: 'Sarvam AI (via Gemma 3 Orchestrator)' };
          }
        }

        if (this.geminiReady) {
          onStatusUpdate?.("Consulting Gemini 3 Flash...");
          if (signal?.aborted) throw new Error("Aborted");
          const geminiResponse = await this.callGemini(prompt, history, imageBase64, signal);
          if (geminiResponse) {
            return { text: geminiResponse, engine: 'Gemini 3 Flash (via Gemma 3 Orchestrator)' };
          }
        }
      }

      // 4. Fallback to Cloud Engines if everything else fails (instead of Mock)
      if (canUseOnline) {
        onStatusUpdate?.("Local brain unavailable. Consulting cloud fallback...");
        if (this.geminiReady) {
          const geminiResponse = await this.callGemini(prompt, history, imageBase64, signal);
          if (geminiResponse) {
            return { text: geminiResponse, engine: 'Gemini 2.5 Flash (Cloud Fallback)' };
          }
        }
      }

      return { 
        text: "Gemma 3 Orchestrator: I am currently unable to reach any specialized legal engines. Please check your connection or ensure the local brain is active.", 
        engine: 'None' 
      };
    };

    return Promise.race([execute(), timeout]);
  }

  public getStatus() {
    this.updateStatus(); // Trigger background update
    return {
      builtIn: this.hasBuiltInAI,
      online: navigator.onLine,
      offlineBrain: localStorage.getItem('offline_brain_installed') === 'true',
      sarvamReady: this.sarvamReady,
      geminiReady: this.geminiReady,
      ollamaReady: this.ollamaReady,
      transformersReady: this.transformersReady,
      transformersLoading: this.transformersLoading
    };
  }
}
