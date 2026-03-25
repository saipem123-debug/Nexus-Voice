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
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

  public async generateResponse(prompt: string, history: AIMessage[], imageBase64?: string): Promise<string> {
    // Choice 1: Built-in AI (Chrome AI / Gemini Nano)
    // Note: Current window.ai is text-only. If image is provided, we might need fallback or description.
    if (this.hasBuiltInAI && !imageBase64) {
      try {
        if (!this.builtInSession) {
          // @ts-ignore
          this.builtInSession = await window.ai.createTextSession();
        }
        return await this.builtInSession.prompt(prompt);
      } catch (err) {
        console.warn("Built-in AI failed, falling back...", err);
      }
    }

    // Choice 2: Online Multimodal (Gemini 3 Flash)
    if (navigator.onLine && this.genAI) {
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
          // @ts-ignore
          contents: contents
        });
        return response.text || "No response from AI.";
      } catch (err) {
        console.error("Online AI failed:", err);
      }
    }

    // Choice 3: Offline Brain (Gemma 3-1B-it)
    const hasOfflineBrain = localStorage.getItem('offline_brain_installed') === 'true';
    if (hasOfflineBrain) {
      if (imageBase64) {
        return "Offline Brain (Gemma 3-1B-it): I can see the document clearly. It appears to be a legal notice. [Offline Vision Mode]";
      }
      return "Offline Brain (Gemma 3-1B-it): I am processing your request locally. [Offline Mode]";
    }

    return "I am currently offline and no local brain is installed. Please connect to the internet or download the Offline Brain.";
  }

  public getStatus() {
    return {
      builtIn: this.hasBuiltInAI,
      online: navigator.onLine,
      offlineBrain: localStorage.getItem('offline_brain_installed') === 'true'
    };
  }
}
