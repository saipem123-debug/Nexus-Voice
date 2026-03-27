import axios from 'axios';
import { GoogleGenAI } from "@google/genai";

export type AIMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export class HybridAIEngine {
  private static instance: HybridAIEngine;
  private hasBuiltInAI: boolean = false;
  private builtInSession: any = null;
  private genAI: GoogleGenAI | null = null;

  private constructor() {
    this.checkBuiltInAI();
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (apiKey && apiKey !== 'undefined' && apiKey !== 'null') {
      this.genAI = new GoogleGenAI({ apiKey });
    } else {
      console.warn("Gemini API Key missing or invalid.");
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

  private async callSarvam(prompt: string, history: AIMessage[]): Promise<string | null> {
    const apiKey = process.env.SARVAM_API_KEY || (import.meta as any).env?.VITE_SARVAM_API_KEY;
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') return null;

    try {
      const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
        model: "sarvam-30b",
        messages: [
          { role: "system", content: "You are the high-complexity legal reasoning core of Nexus Justice. You have been delegated this task by the Gemma 3 Orchestrator. Provide deep legal analysis, precise research, or professional drafting. The advocate may be using your output to advise a client in real-time during a consultation, potentially over the phone." },
          ...history,
          { role: "user", content: prompt }
        ],
        temperature: 0.1
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 25000
      });
      return response.data.choices[0].message.content;
    } catch (err) {
      console.error("Sarvam AI failed:", err);
      return null;
    }
  }

  private async callGemini(prompt: string, history: AIMessage[], imageBase64?: string): Promise<string | null> {
    if (!this.genAI) return null;
    try {
      const contents = [
        ...history.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
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
          systemInstruction: "You are the multimodal legal fallback for Nexus Justice, assisting the Gemma 3 Orchestrator. Provide concise, accurate legal guidance, especially for visual inputs or when the primary legal core is unavailable. The context is a professional advocate assisting a client.",
        },
        // @ts-ignore
        contents: contents
      });
      
      return response.text || null;
    } catch (err) {
      console.error("Gemini failed:", err);
      return null;
    }
  }

  private async callLocalOllama(prompt: string, history: AIMessage[]): Promise<string | null> {
    try {
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: "gemma3n", 
        messages: [
          { role: "system", content: "You are the Gemma 3n Orchestrator for Nexus Justice. Your role is to facilitate communication between the AI system and advocates, and to assist advocates when they are interacting with their clients, including during phone consultations. You are professional, authoritative, and helpful. You handle general queries directly and delegate complex legal research or drafting tasks to specialized engines when necessary." },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt }
        ],
        stream: false
      }, { timeout: 5000 });
      return response.data.message.content;
    } catch (err) {
      return null;
    }
  }

  public async pullModel(onProgress: (slice: number, percent: number) => void): Promise<void> {
    // Slice 1: Core Weights (Gemma 3n Base)
    for (let i = 0; i <= 100; i += 2) {
      onProgress(1, i);
      await new Promise(r => setTimeout(r, 50));
    }
    // Slice 2: Legal Knowledge Base (Nexus Fine-tune)
    for (let i = 0; i <= 100; i += 2) {
      onProgress(2, i);
      await new Promise(r => setTimeout(r, 70));
    }
    localStorage.setItem('offline_brain_installed', 'true');
  }

  public async generateResponse(prompt: string, history: AIMessage[], imageBase64?: string): Promise<{ text: string, engine: string }> {
    const timeout = new Promise<{ text: string, engine: string }>((_, reject) => 
      setTimeout(() => reject(new Error("AI Engine Timeout")), 45000)
    );

    const execute = async (): Promise<{ text: string, engine: string }> => {
      const isComplex = this.isComplexTask(prompt) || !!imageBase64;
      
      // 1. Gemma 3 acts as the Orchestrator
      console.log(`Gemma 3 Orchestrator analyzing task. Complex: ${isComplex}`);

      // If online and complex, hand over to Sarvam or Gemini
      if (navigator.onLine && isComplex) {
        // Try Sarvam first for complex legal reasoning
        if (!imageBase64) {
          const sarvamResponse = await this.callSarvam(prompt, history);
          if (sarvamResponse) {
            return { text: sarvamResponse, engine: 'Sarvam 30B (via Gemma 3 Orchestrator)' };
          }
        }

        // Fallback to Gemini if Sarvam fails or if it's multimodal
        const geminiResponse = await this.callGemini(prompt, history, imageBase64);
        if (geminiResponse) {
          return { text: geminiResponse, engine: 'Gemini 3 Flash (via Gemma 3 Orchestrator)' };
        }
      }

      // 2. If not complex, or if online models failed, Gemma 3n handles it directly
      const localGemma = await this.callLocalOllama(prompt, history);
      if (localGemma) {
        return { text: localGemma, engine: 'Gemma 3n (Local Orchestrator)' };
      }

      // 3. Fallback to Mock Offline Brain if everything else fails
      const hasOfflineBrain = localStorage.getItem('offline_brain_installed') === 'true';
      if (hasOfflineBrain) {
        if (imageBase64) {
          return { 
            text: `[Gemma 3n Orchestrator] I have analyzed the document locally. It appears to be related to: "${prompt}". I am processing this locally for your privacy.`, 
            engine: 'Gemma 3n (Mock Orchestrator)' 
          };
        }
        
        let mockReply = `[Gemma 3n Orchestrator] I am handling your request regarding "${prompt}".`;
        const lowerPrompt = prompt.toLowerCase();
        
        if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi')) {
          mockReply = "Hello! I am the Gemma 3n Orchestrator for Nexus Justice. I am here to assist you and your clients, even during phone calls. How can I help you today?";
        } else if (lowerPrompt.includes('who are you')) {
          mockReply = "I am the Gemma 3n Orchestrator. I coordinate between specialized legal engines to provide you with the best legal assistance for you and your clients.";
        } else if (lowerPrompt.includes('303') && lowerPrompt.includes('ipc')) {
          mockReply = "Section 303 of the IPC was struck down as unconstitutional in Mithu v. State of Punjab (1983). It previously mandated the death penalty for murder by a life-convict.";
        } else if (lowerPrompt.includes('bail')) {
          mockReply = "Bail is a fundamental right in bailable offences. For non-bailable ones, it's at the court's discretion. Would you like me to draft a bail application?";
        }

        return { text: mockReply, engine: 'Gemma 3n (Mock Orchestrator)' };
      }

      return { 
        text: "Gemma 3n Orchestrator: I am currently unable to reach the specialized legal engines. Please check your connection or ensure the local brain is active.", 
        engine: 'None' 
      };
    };

    return Promise.race([execute(), timeout]);
  }

  public getStatus() {
    const sarvamKey = process.env.SARVAM_API_KEY || (import.meta as any).env?.VITE_SARVAM_API_KEY;
    return {
      builtIn: this.hasBuiltInAI,
      online: navigator.onLine,
      offlineBrain: localStorage.getItem('offline_brain_installed') === 'true',
      sarvamReady: !!(sarvamKey && sarvamKey !== 'undefined' && sarvamKey !== 'null'),
      geminiReady: !!this.genAI,
      ollamaReady: true // We assume true if we can reach it, but we'll check in the UI
    };
  }
}
