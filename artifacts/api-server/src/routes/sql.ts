import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import * as mssql from "mssql";
import fs from "fs";
import path from "path";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { getPool, testConnection, getPublicConfig, updateSqlConfig, isConfigured, type SqlConfigData } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many barcode queries. Please wait a moment." },
});

// 1. Run Barcode Query - Protected for all authenticated users with search permission
router.post("/sql/query", requireAuth, queryLimiter, async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.canSearch) {
    res.status(403).json({ error: "Search permission denied" });
    return;
  }

  const { barcode } = req.body as { barcode?: unknown };

  if (typeof barcode !== "string" || !barcode.trim()) {
    res.status(400).json({ error: "Barcode is required" });
    return;
  }

  if (!isConfigured()) {
    res.status(503).json({ error: "Database connection is not configured on the server" });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("barcode", mssql.NVarChar, barcode.trim())
      .query(`
        SELECT
          auto_no                                    AS [ژماره‌ی ئوتومبیل],
          bash                                       AS [به‌شی],
          plet                                       AS [پاریزگا],
          Name_                                      AS [ناوی سیانی],
          CONVERT(VARCHAR(10), Date_,   120)         AS [به‌رواری هاتن],
          car_type                                   AS [جۆری ئوتومبیل],
          shassy,
          CC,
          resulat                                    AS [ئه‌نجام],
          mobile,
          N_pshknin                                  AS [پشكنینی],
          CONVERT(VARCHAR(10), date_ex, 120)         AS [به‌سه‌رچوون]
        FROM VA
        WHERE Barcod = @barcode
      `);

    const rows = result.recordset as Record<string, unknown>[];
    res.json({ found: rows.length > 0, rows });
  } catch (err: unknown) {
    logger.error({ err }, "SQL barcode query failed");
    res.status(500).json({ error: "Database query failed. Please check server logs." });
  }
});

// 2. Test Connection - Admin only
router.post("/sql/test", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Partial<SqlConfigData> | undefined;
    const hasOverride = body && typeof body.server === "string" && body.server.trim();
    const result = await testConnection(hasOverride ? body : undefined);
    res.json(result);
  } catch (err: unknown) {
    logger.warn({ err }, "SQL connection test failed");
    res.status(400).json({ error: "Connection test failed. Verify server address and credentials." });
  }
});

// 3. Get Public SQL Config - Admin only (does not return password)
router.get("/sql/config", requireAdmin, (_req: Request, res: Response): void => {
  res.json({
    configured: isConfigured(),
    config: getPublicConfig(),
  });
});

// 4. Update SQL Config - Admin only
router.post("/sql/config", requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const newConfig = req.body as Partial<SqlConfigData>;

  if (!newConfig || typeof newConfig !== "object") {
    res.status(400).json({ error: "Invalid configuration data" });
    return;
  }

  try {
    // Test the new configuration first
    await testConnection(newConfig);

    // If test passed, apply it to the server
    await updateSqlConfig(newConfig);

    // Persist to .env safely (preventing newline injection)
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8");
        if (newConfig.server !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_SERVER", newConfig.server);
        if (newConfig.database !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_DATABASE", newConfig.database);
        if (newConfig.user !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_USER", newConfig.user);
        if (newConfig.password !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_PASSWORD", newConfig.password);
        if (newConfig.port !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_PORT", String(newConfig.port));
        if (newConfig.windowsAuth !== undefined) envContent = replaceOrAppendEnv(envContent, "SQL_WINDOWS_AUTH", String(newConfig.windowsAuth));
        fs.writeFileSync(envPath, envContent, "utf-8");
      }
    } catch (fsErr) {
      logger.warn({ err: fsErr }, "Failed to persist new SQL config to .env file");
    }

    res.json({ success: true, message: "Configuration updated and connected successfully" });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to update SQL config");
    res.status(400).json({ error: "Failed to connect with the provided configuration." });
  }
});

function replaceOrAppendEnv(content: string, key: string, value: string): string {
  const sanitized = String(value).replace(/[\r\n]+/g, "");
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${sanitized}`);
  }
  return content + `\n${key}=${sanitized}`;
}

export default router;
