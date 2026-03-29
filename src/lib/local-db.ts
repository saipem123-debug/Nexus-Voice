import initSqlJs, { Database } from 'sql.js';

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

    const cdns = [
      'https://sql.js.org/dist/sql-wasm.wasm',
      'https://unpkg.com/sql.js@1.12.0/dist/sql-wasm.wasm',
      'https://cdn.jsdelivr.net/npm/sql.js@1.12.0/dist/sql-wasm.wasm',
      'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm'
    ];

    let wasmBinary: ArrayBuffer | null = null;
    let lastError: any = null;

    for (const url of cdns) {
      try {
        console.log(`Nexus: Attempting to fetch SQL WASM from ${url}`);
        const response = await fetch(url);
        if (response.ok) {
          wasmBinary = await response.arrayBuffer();
          console.log(`Nexus: SQL WASM fetched successfully from ${url} (${wasmBinary.byteLength} bytes)`);
          break;
        } else {
          console.warn(`Nexus: Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
          lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (err: any) {
        console.warn(`Nexus: Error fetching from ${url}:`, err);
        lastError = err;
      }
    }

    if (!wasmBinary) {
      throw new Error(`Failed to fetch SQL WASM from all CDNs. Last error: ${lastError?.message || 'Unknown error'}`);
    }

    try {
      const SQL = await initSqlJs({
        wasmBinary: wasmBinary
      });
      console.log("Nexus: SQL.js initialized successfully");

      // Try to load from IndexedDB or start fresh
      const savedData = localStorage.getItem('nexus_sqlite_db');
      if (savedData) {
        const u8 = new Uint8Array(JSON.parse(savedData));
        this.db = new SQL.Database(u8);
      } else {
        this.db = new SQL.Database();
        this.createTables();
      }
    } catch (err: any) {
      console.error("Nexus: Failed to initialize sql.js with binary:", err);
      throw err;
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
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT,
        content TEXT,
        engine TEXT,
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
    if (!this.db) return null;
    this.db.run(sql, params);
    this.save();
    try {
      const res = this.db.exec("SELECT last_insert_rowid()");
      return res[0].values[0][0] as number;
    } catch (e) {
      return null;
    }
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
