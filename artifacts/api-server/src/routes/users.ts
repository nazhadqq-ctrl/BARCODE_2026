import { Router, type IRouter } from "express";
import * as mssql from "mssql";

const router: IRouter = Router();

function buildConfig(conn: {
  server: string;
  database: string;
  user?: string;
  password?: string;
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

function isConn(v: unknown): v is { server: string; database: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o["server"] === "string" && typeof o["database"] === "string";
}

router.post("/users/login", async (req, res) => {
  const { connection, username, password } = req.body as { connection: unknown; username: unknown; password: unknown };
  if (!isConn(connection) || typeof username !== "string" || !username.trim()) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(buildConfig(connection as Parameters<typeof buildConfig>[0]));

    const result = await pool
      .request()
      .input("username", mssql.NVarChar, username.trim())
      .query("SELECT id, User_, password, permetion, on_off FROM USERS WHERE User_ = @username");

    const rows = result.recordset as Array<{
      id: number;
      User_: string;
      password: string | null;
      permetion: string | null;
      on_off: string | null;
    }>;

    if (rows.length === 0) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const user = rows[0];

    if ((user.password ?? "") !== (typeof password === "string" ? password : "")) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if ((user.on_off ?? "").toLowerCase() !== "yes") {
      res.status(403).json({ error: "Account is disabled" });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.User_,
        permetion: user.permetion ?? "",
        on_off: user.on_off ?? "",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Users login failed");
    res.status(500).json({ error: message });
  } finally {
    if (pool) { try { await pool.close(); } catch {} }
  }
});

router.post("/users/list", async (req, res) => {
  const { connection } = req.body as { connection: unknown };
  if (!isConn(connection)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(buildConfig(connection as Parameters<typeof buildConfig>[0]));
    const result = await pool
      .request()
      .query("SELECT id, User_, permetion, on_off FROM USERS ORDER BY id");
    res.json({ users: result.recordset });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Users list failed");
    res.status(500).json({ error: message });
  } finally {
    if (pool) { try { await pool.close(); } catch {} }
  }
});

router.post("/users/add", async (req, res) => {
  const { connection, user } = req.body as {
    connection: unknown;
    user: unknown;
  };
  if (!isConn(connection) || !user || typeof user !== "object") {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const u = user as Record<string, unknown>;
  if (typeof u["User_"] !== "string" || !u["User_"].trim()) {
    res.status(400).json({ error: "User_ is required" });
    return;
  }

  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(buildConfig(connection as Parameters<typeof buildConfig>[0]));
    await pool
      .request()
      .input("User_", mssql.NVarChar, String(u["User_"]).trim())
      .input("password", mssql.NVarChar, String(u["password"] ?? ""))
      .input("permetion", mssql.NVarChar, String(u["permetion"] ?? ""))
      .input("on_off", mssql.NVarChar, String(u["on_off"] ?? "no"))
      .query("INSERT INTO USERS (User_, password, permetion, on_off) VALUES (@User_, @password, @permetion, @on_off)");
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Users add failed");
    res.status(500).json({ error: message });
  } finally {
    if (pool) { try { await pool.close(); } catch {} }
  }
});

router.put("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { connection, user } = req.body as { connection: unknown; user: unknown };
  if (!isConn(connection) || !user || typeof user !== "object") {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const u = user as Record<string, unknown>;

  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(buildConfig(connection as Parameters<typeof buildConfig>[0]));
    await pool
      .request()
      .input("id", mssql.Int, id)
      .input("User_", mssql.NVarChar, String(u["User_"] ?? "").trim())
      .input("password", mssql.NVarChar, String(u["password"] ?? ""))
      .input("permetion", mssql.NVarChar, String(u["permetion"] ?? ""))
      .input("on_off", mssql.NVarChar, String(u["on_off"] ?? "no"))
      .query("UPDATE USERS SET User_ = @User_, password = @password, permetion = @permetion, on_off = @on_off WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Users update failed");
    res.status(500).json({ error: message });
  } finally {
    if (pool) { try { await pool.close(); } catch {} }
  }
});

router.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { connection } = req.body as { connection: unknown };
  if (!isConn(connection)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  let pool: mssql.ConnectionPool | null = null;
  try {
    pool = await mssql.connect(buildConfig(connection as Parameters<typeof buildConfig>[0]));
    await pool
      .request()
      .input("id", mssql.Int, id)
      .query("DELETE FROM USERS WHERE id = @id");
    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "Users delete failed");
    res.status(500).json({ error: message });
  } finally {
    if (pool) { try { await pool.close(); } catch {} }
  }
});

export default router;
