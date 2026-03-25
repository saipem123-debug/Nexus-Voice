import initSqlJs, { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export class LocalDB {
  private static instance: LocalDB;
  private db: Database | null = null;

  private constructor() {}

  public static getInstance(): LocalDB {
    if (!LocalDB.instance) {
      LocalDB.instance = new LocalDB();
    }
    return LocalDB.instance;
  }

  public async init() {
    if (this.db) return;

    const SQL = await initSqlJs({
      // Using Vite's asset URL feature for better reliability and performance
      locateFile: () => sqlWasmUrl
    }).catch(err => {
      console.error("Failed to initialize sql.js:", err);
      // Fallback or re-throw with a clearer message
      if (err.message?.includes('wasm streaming compile failed')) {
        throw new Error("Wasm streaming failed. This might be due to a network error or a missing wasm file on the CDN.");
      }
      throw err;
    });

    // Try to load from IndexedDB or start fresh
    const savedData = localStorage.getItem('nexus_sqlite_db');
    if (savedData) {
      const u8 = new Uint8Array(JSON.parse(savedData));
      this.db = new SQL.Database(u8);
    } else {
      this.db = new SQL.Database();
      this.createTables();
    }
  }

  private createTables() {
    if (!this.db) return;
    this.db.run(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        case_number TEXT,
        court TEXT,
        next_date TEXT,
        purpose TEXT
      );
      CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        transcript TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    this.save();
  }

  public save() {
    if (!this.db) return;
    const data = this.db.export();
    const arr = Array.from(data);
    localStorage.setItem('nexus_sqlite_db', JSON.stringify(arr));
  }

  public run(sql: string, params?: any[]) {
    if (!this.db) return;
    this.db.run(sql, params);
    this.save();
  }

  public query(sql: string, params?: any[]) {
    if (!this.db) return [];
    const res = this.db.exec(sql, params);
    if (res.length === 0) return [];
    
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj: any = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }
}
