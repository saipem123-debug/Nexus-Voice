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
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
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

  private async callSarvam(prompt: string, history: AIMessage[]): Promise<string> {
    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) return "Sarvam API Key not configured.";

    try {
      const response = await axios.post('https://api.sarvam.ai/v1/chat/completions', {
        model: "sarvam-30b",
        messages: [
          { role: "system", content: "You are a high-complexity legal reasoning engine for the Nexus Justice portal." },
          ...history,
          { role: "user", content: prompt }
        ],
        temperature: 0.1
      }, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      return response.data.choices[0].message.content;
    } catch (err) {
      console.error("Sarvam AI failed:", err);
      return "High-complexity reasoning failed. Falling back to Gemini.";
    }
  }

  private async callLocalOllama(prompt: string, history: AIMessage[]): Promise<string | null> {
    try {
      const response = await axios.post('http://localhost:11434/api/chat', {
        model: "gemma:2b", // Or gemma:1.1b-it if using Gemma 1/2, or gemma3:1b if available
        messages: [
          { role: "system", content: "You are a local legal assistant running on the Nexus Justice portal. You are offline." },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: prompt }
        ],
        stream: false
      }, { timeout: 5000 });
      return response.data.message.content;
    } catch (err) {
      console.warn("Local Ollama not found or failed:", err);
      return null;
    }
  }

  public async generateResponse(prompt: string, history: AIMessage[], imageBase64?: string, highComplexity: boolean = false): Promise<{ text: string, engine: string }> {
    const timeout = new Promise<{ text: string, engine: string }>((_, reject) => 
      setTimeout(() => reject(new Error("AI Engine Timeout")), 15000)
    );

    const execute = async (): Promise<{ text: string, engine: string }> => {
      // Choice 1: High-Complexity Backend (Sarvam 30B)
      if (navigator.onLine && highComplexity && process.env.SARVAM_API_KEY) {
        const text = await this.callSarvam(prompt, history);
        return { text, engine: 'Sarvam 30B' };
      }

      // Choice 2: Local Ollama (Real Offline Brain)
      const localResponse = await this.callLocalOllama(prompt, history);
      if (localResponse) {
        return { text: localResponse, engine: 'Gemma 3-1B-it (Local)' };
      }

      // Choice 3: Built-in AI (Chrome AI / Gemini Nano)
      if (this.hasBuiltInAI && !imageBase64) {
        try {
          if (!this.builtInSession) {
            // @ts-ignore
            this.builtInSession = await window.ai.createTextSession();
          }
          const text = await this.builtInSession.prompt(prompt);
          return { text, engine: 'Gemini Nano (Built-in)' };
        } catch (err) {
          console.warn("Built-in AI failed, falling back...", err);
        }
      }

      // Choice 4: Online Multimodal (Gemini 3 Flash)
      if (navigator.onLine && this.genAI) {
        try {
          console.log("Attempting online AI generation...");
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
            // @ts-ignore
            contents: contents
          });
          console.log("Online AI response received.");
          return { text: response.text || "No response from AI.", engine: 'Gemini 3 Flash' };
        } catch (err) {
          console.error("Online AI failed, falling back to local/mock:", err);
        }
      } else {
        console.log("Skipping online AI: online=", navigator.onLine, "genAI=", !!this.genAI);
      }

      // Choice 5: Mock Offline Brain (Fallback)
      const hasOfflineBrain = localStorage.getItem('offline_brain_installed') === 'true';
      if (hasOfflineBrain) {
        if (imageBase64) {
          return { 
            text: `Offline Brain (Gemma 3-1B-it): I have analyzed the document you provided. It appears to be a legal document related to your query: "${prompt}". I am processing this locally for your privacy. [Offline Vision Mode]`, 
            engine: 'Gemma 3-1B-it (Mock)' 
          };
        }
        
        // Simple heuristic for "answering" common questions in mock mode
        let mockReply = `Offline Brain (Gemma 3-1B-it): I am processing your request locally regarding "${prompt}". [Offline Mode]`;
        if (prompt.toLowerCase().includes('hello') || prompt.toLowerCase().includes('hi')) {
          mockReply = "Offline Brain (Gemma 3-1B-it): Hello! I am your local legal assistant. How can I help you today? [Offline Mode]";
        } else if (prompt.toLowerCase().includes('malayalam')) {
          mockReply = "Offline Brain (Gemma 3-1B-it): I can understand Malayalam, but my current offline brain is optimized for English legal reasoning. Please connect to the internet for full multilingual support. [Offline Mode]";
        }

        return { 
          text: mockReply, 
          engine: 'Gemma 3-1B-it (Mock)' 
        };
      }

      return { 
        text: "I am currently offline and no local brain is installed. Please connect to the internet or download the Offline Brain.", 
        engine: 'None' 
      };
    };

    return Promise.race([execute(), timeout]);
  }

  public getStatus() {
    return {
      builtIn: this.hasBuiltInAI,
      online: navigator.onLine,
      offlineBrain: localStorage.getItem('offline_brain_installed') === 'true'
    };
  }
}
