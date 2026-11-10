import * as mssql from "mssql";
import { logger } from "./logger";

export interface SqlConfigData {
  server: string;
  database: string;
  user?: string;
  password?: string;
  port?: number | null;
  windowsAuth?: boolean | null;
}

let currentConfig: SqlConfigData = {
  server: process.env.SQL_SERVER || "",
  database: process.env.SQL_DATABASE || "",
  user: process.env.SQL_USER || "",
  password: process.env.SQL_PASSWORD || "",
  port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 1433,
  windowsAuth: process.env.SQL_WINDOWS_AUTH === "true",
};

let pool: mssql.ConnectionPool | null = null;
let connectingPromise: Promise<mssql.ConnectionPool> | null = null;

export function buildMssqlConfig(conn: SqlConfigData): mssql.config {
  const useWindowsAuth = conn.windowsAuth === true;
  const cleanServer = conn.server ? conn.server.trim() : "";
  const cleanDatabase = conn.database ? conn.database.trim() : "";
  const cleanUser = conn.user ? conn.user.trim() : "";
  const cleanPassword = conn.password ? conn.password.trim() : "";

  return {
    server: cleanServer,
    database: cleanDatabase,
    user: useWindowsAuth ? undefined : cleanUser,
    password: useWindowsAuth ? undefined : cleanPassword,
    port: conn.port ?? 1433,
    domain: useWindowsAuth ? cleanServer : undefined,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 10000,
      trustedConnection: useWindowsAuth,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export function isConfigured(): boolean {
  return Boolean(currentConfig.server && currentConfig.database);
}

export function getPublicConfig(): Omit<SqlConfigData, "password"> & { hasPassword: boolean } {
  return {
    server: currentConfig.server,
    database: currentConfig.database,
    user: currentConfig.user,
    port: currentConfig.port,
    windowsAuth: currentConfig.windowsAuth,
    hasPassword: Boolean(currentConfig.password),
  };
}

export async function closePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
    } catch (err) {
      logger.warn({ err }, "Error closing previous SQL pool");
    }
    pool = null;
  }
}

export async function updateSqlConfig(newConfig: Partial<SqlConfigData>): Promise<void> {
  currentConfig = {
    ...currentConfig,
    ...newConfig,
    server: (newConfig.server ?? currentConfig.server).trim(),
    database: (newConfig.database ?? currentConfig.database).trim(),
    user: (newConfig.user ?? currentConfig.user)?.trim(),
    password: newConfig.password !== undefined ? newConfig.password.trim() : currentConfig.password,
    port: newConfig.port ?? currentConfig.port ?? 1433,
    windowsAuth: newConfig.windowsAuth ?? currentConfig.windowsAuth ?? false,
  };

  await closePool();
}

export async function getPool(): Promise<mssql.ConnectionPool> {
  if (!isConfigured()) {
    throw new Error("SQL Server connection is not configured on the server");
  }

  if (pool && pool.connected) {
    return pool;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      await closePool();
      const config = buildMssqlConfig(currentConfig);
      pool = await mssql.connect(config);
      pool.on("error", (err) => {
        logger.error({ err }, "MSSQL Connection Pool background error");
      });
      logger.info({ server: currentConfig.server, database: currentConfig.database }, "SQL Connection Pool created");
      return pool;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export async function testConnection(override?: SqlConfigData): Promise<{ success: boolean; message: string }> {
  const cfg = override ? { ...currentConfig, ...override } : currentConfig;
  if (!cfg.server || !cfg.database) {
    throw new Error("Server and Database names are required");
  }

  const mssqlConfig = buildMssqlConfig(cfg);
  let testPool: mssql.ConnectionPool | null = null;
  try {
    testPool = await mssql.connect(mssqlConfig);
    await testPool.request().query("SELECT 1 AS test");
    return { success: true, message: "Connection successful" };
  } finally {
    if (testPool) {
      try {
        await testPool.close();
      } catch {}
    }
  }
}

