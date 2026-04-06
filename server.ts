import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import cookieSession from "cookie-session";
import db from "./src/lib/server-db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // MongoDB Connection (Optional, keeping for compatibility if needed)
  if (process.env.MONGODB_URI) {
    mongoose.connect(process.env.MONGODB_URI)
      .then(() => console.log("Connected to MongoDB"))
      .catch(err => console.error("MongoDB connection error:", err));
  }

  app.use(express.json());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'nexus-secret'],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }));

  // --- OAuth 2.0 Client Setup ---
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID || 'dummy-id',
    process.env.GOOGLE_CLIENT_SECRET || 'dummy-secret'
  );

  // --- API Routes ---
  app.use(express.static(path.join(process.cwd(), 'public')));

  // AI Status
  app.get("/api/ai/status", (req: any, res) => {
    const userId = req.session.userId;
    let geminiConfigured = !!process.env.GEMINI_API_KEY;
    
    if (userId) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (user && user.refresh_token) {
        geminiConfigured = true;
      }
    }

    res.json({
      geminiConfigured,
      isLoggedIn: !!userId
    });
  });

  // Google OAuth URL for Gemini BYOK
  app.get("/api/auth/url", (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in environment variables.");
      return res.status(500).json({ error: "Google OAuth credentials not configured in environment variables." });
    }

    // Use APP_URL if provided, otherwise derive from request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/auth/callback`;

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      redirect_uri: redirectUri,
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/generative-language'
      ]
    });
    res.json({ url });
  });

  // OAuth Callback Handler
  app.get("/auth/callback", async (req: any, res) => {
    const { code } = req.query;
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const baseUrl = process.env.APP_URL || `${protocol}://${host}`;
      const redirectUri = `${baseUrl}/auth/callback`;
      console.log('OAuth Callback - Redirect URI:', redirectUri);
      console.log('OAuth Callback - Code received:', !!code);

      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      oauth2Client.setCredentials(tokens);

      // Get user info to identify them
      const ticket = await oauth2Client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const userId = payload?.sub;
      const email = payload?.email;

      if (userId) {
        // Store in SQLite
        const stmt = db.prepare(`
          INSERT INTO users (id, email, refresh_token, access_token, expiry_date)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            refresh_token = COALESCE(excluded.refresh_token, users.refresh_token),
            access_token = excluded.access_token,
            expiry_date = excluded.expiry_date
        `);
        stmt.run(userId, email, tokens.refresh_token || null, tokens.access_token, tokens.expiry_date);

        req.session.userId = userId;
      }

      res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #020617; color: white; text-align: center; }
              .spinner { border: 4px solid rgba(255,255,255,0.1); border-left-color: #6366f1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { to { transform: rotate(360deg); } }
              h1 { font-size: 1.5rem; margin-bottom: 10px; }
              p { color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <h1>Authentication Successful</h1>
            <p>Closing this window and returning to Nexus Justice...</p>
            <button id="closeBtn" style="display: none; margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Close Window</button>
            <script>
              console.log('Callback script running...');
              try {
                if (window.opener) {
                  console.log('Opener found, sending message...');
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', userId: '${userId}' }, '*');
                  setTimeout(() => {
                    console.log('Closing window...');
                    window.close();
                    // Fallback if window.close() is blocked
                    document.getElementById('closeBtn').style.display = 'block';
                    document.getElementById('closeBtn').onclick = () => window.close();
                  }, 1500);
                } else {
                  console.error('Opener not found');
                  document.body.innerHTML = '<h1>Error</h1><p>Opener window not found. Please close this window and try again.</p><button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Close Window</button>';
                }
              } catch (e) {
                console.error('PostMessage error:', e);
                document.body.innerHTML = '<h1>Error</h1><p>Failed to communicate with main window. ' + e.message + '</p><button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Close Window</button>';
              }
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Proxy route to get Access Token for Gemini
  app.get("/api/ai/token", async (req: any, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if token is expired (with 5 min buffer)
    if (user.expiry_date && Date.now() < user.expiry_date - 300000) {
      return res.json({ accessToken: user.access_token });
    }

    // Refresh token
    if (!user.refresh_token) return res.status(400).json({ error: "No refresh token available" });

    try {
      oauth2Client.setCredentials({ refresh_token: user.refresh_token });
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      const stmt = db.prepare(`
        UPDATE users SET access_token = ?, expiry_date = ? WHERE id = ?
      `);
      stmt.run(credentials.access_token, credentials.expiry_date, userId);

      res.json({ accessToken: credentials.access_token });
    } catch (error) {
      console.error("Token refresh error:", error);
      res.status(500).json({ error: "Failed to refresh token" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session = null;
    res.json({ success: true });
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
