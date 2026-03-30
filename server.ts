import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import { google } from "googleapis";
import cookieSession from "cookie-session";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // MongoDB Connection
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log("Connected to MongoDB"))
      .catch(err => console.error("MongoDB connection error:", err));
  }

  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'nexus-secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none'
  }));

  // --- API Routes ---
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Sarvam 30B Proxy
  app.get("/api/ai/status", (req, res) => {
    res.json({
      sarvamConfigured: !!process.env.SARVAM_API_KEY,
      geminiConfigured: !!process.env.GEMINI_API_KEY
    });
  });

  app.post("/api/ai/sarvam", async (req, res) => {
    const { prompt, history } = req.body;
    try {
      // Correct endpoint for Sarvam AI Chat Completions
      const response = await axios.post("https://api.sarvam.ai/v1/chat/completions", {
        model: "sarvam-30b",
        messages: [
          { 
            role: "system", 
            content: "You are Nexus Justice, a specialized legal AI assistant powered by Sarvam AI. You are NOT Gemini, NOT GPT, and NOT Claude. You are a senior legal expert providing precise advice based on Indian and International law. Always identify as Nexus Justice." 
          },
          ...history,
          { role: "user", content: prompt }
        ]
      }, {
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Sarvam API error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to fetch from Sarvam AI",
        details: error.response?.data || error.message
      });
    }
  });

  // Sarvam TTS (Bulbul V3)
  app.post("/api/ai/sarvam/tts", async (req, res) => {
    const { text } = req.body;
    try {
      const response = await axios.post("https://api.sarvam.ai/v1/text-to-speech", {
        inputs: [text],
        target_language_code: "en-IN",
        speaker: "meera", // Default speaker
        model: "bulbul:v3"
      }, {
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Sarvam TTS error:", error.response?.data || error.message);
      res.status(500).json({ error: "Sarvam TTS failed" });
    }
  });

  // Sarvam STT (Saaras V3)
  app.post("/api/ai/sarvam/stt", async (req, res) => {
    const { audio_content } = req.body; // base64
    try {
      const response = await axios.post("https://api.sarvam.ai/v1/speech-to-text", {
        model: "saaras:v3",
        language_code: "en-IN",
        audio_content
      }, {
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Sarvam STT error:", error.response?.data || error.message);
      res.status(500).json({ error: "Sarvam STT failed" });
    }
  });

  // Sarvam Vision
  app.post("/api/ai/sarvam/vision", async (req, res) => {
    const { prompt, imageBase64 } = req.body;
    try {
      const response = await axios.post("https://api.sarvam.ai/v1/vision", {
        model: "sarvam-vision",
        prompt,
        image: imageBase64
      }, {
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Sarvam Vision error:", error.response?.data || error.message);
      res.status(500).json({ error: "Sarvam Vision failed" });
    }
  });

  // Sarvam Translation
  app.post("/api/ai/sarvam/translate", async (req, res) => {
    const { input, target_language_code, source_language_code } = req.body;
    try {
      const response = await axios.post("https://api.sarvam.ai/v1/translate", {
        input,
        target_language_code,
        source_language_code,
        model: "mayura:v1"
      }, {
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json"
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Sarvam Translation error:", error.response?.data || error.message);
      res.status(500).json({ error: "Sarvam Translation failed" });
    }
  });

  // Google OAuth for Drive
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/callback`
  );

  app.get("/api/auth/url", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file']
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req: any, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      req.session.tokens = tokens;
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send("Authentication failed");
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, path) => {
        if (path.endsWith('.wasm')) {
          res.set('Content-Type', 'application/wasm');
        }
      }
    }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
