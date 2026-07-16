import { Router, type IRouter } from "express";
import * as mssql from "mssql";
import { TestSqlConnectionBody, RunBarcodeQueryBody } from "@workspace/api-zod";

const router: IRouter = Router();

function buildConfig(conn: {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number | null;
  windowsAuth?: boolean | null;
}): mssql.config {
  const useWindowsAuth = conn.windowsAuth === true;
  return {
    server: conn.server,
    database: conn.database,
    user: useWindowsAuth ? undefined : conn.user,
    password: useWindowsAuth ? undefined : conn.password,
    port: conn.port ?? 1433,
    domain: useWindowsAuth ? conn.server : undefined,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      connectTimeout: 10000,
      trustedConnection: useWindowsAuth,
    },
  };
}

router.post("/sql/test", async (req, res) => {
  const parsed = TestSqlConnectionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const config = buildConfig(parsed.data);
  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(config);
    await pool.request().query("SELECT 1 AS test");
    res.json({ success: true, message: "Connection successful" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.warn({ err }, "SQL connection test failed");
    res.status(400).json({ error: message });
  } finally {
    if (pool) {
      try { await pool.close(); } catch {}
    }
  }
});

router.post("/sql/query", async (req, res) => {
  const parsed = RunBarcodeQueryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { connection, barcode } = parsed.data;
  const config = buildConfig(connection);
  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(config);
    const result = await pool
      .request()
      .input("barcode", mssql.NVarChar, barcode)
      .query(`
        SELECT
          auto_no                                    AS [ژماره‌ی ئوتومبیل],
          bash                                       AS [به‌شی],
          plet                                       AS [پاریزگا],
          Name_                                      AS [ناوی سیانی],
          CONVERT(VARCHAR(10), Date_,   120)         AS [به‌رواری هاتن],
          car_type                                   AS [جۆری ئوتومبیل],
          shassy,
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
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "SQL barcode query failed");
    res.status(400).json({ error: message });
  } finally {
    if (pool) {
      try { await pool.close(); } catch {}
    }
  }
});

export default router;
