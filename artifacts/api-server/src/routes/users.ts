import { Router, type IRouter, type Request, type Response } from "express";
import * as mssql from "mssql";
import { requireAdmin } from "../middlewares/auth";
import { getPool, isConfigured } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Protect all user management routes with admin-only requirement
router.use(requireAdmin);

async function checkDbConfigured(res: Response): Promise<boolean> {
  if (!isConfigured()) {
    res.status(503).json({ error: "SQL Server is not configured" });
    return false;
  }
  return true;
}

// 1. List Users
async function handleListUsers(_req: Request, res: Response): Promise<void> {
  if (!(await checkDbConfigured(res))) return;

  try {
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT id, User_, permetion, on_off FROM USERS ORDER BY id ASC"
    );

    res.json({ success: true, users: result.recordset });
  } catch (err: unknown) {
    logger.error({ err }, "Failed to list users");
    res.status(500).json({ error: "Failed to retrieve user list" });
  }
}

router.get("/users/list", handleListUsers);
router.post("/users/list", handleListUsers); // backwards compatibility

// 2. Add User
router.post("/users/add", async (req: Request, res: Response): Promise<void> => {
  if (!(await checkDbConfigured(res))) return;

  const { user } = req.body as {
    user?: {
      User_?: unknown;
      password?: unknown;
      permetion?: unknown;
      on_off?: unknown;
    };
  };

  if (!user || typeof user.User_ !== "string" || !user.User_.trim()) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const cleanUser = user.User_.trim();
  const cleanPass = typeof user.password === "string" ? user.password.trim() : "";
  const cleanPerm = typeof user.permetion === "string" ? user.permetion.trim() : "user";
  const cleanOnOff = typeof user.on_off === "string" ? user.on_off.trim() : "yes";

  try {
    const pool = await getPool();

    // Check if user already exists
    const existing = await pool
      .request()
      .input("username", mssql.NVarChar, cleanUser)
      .query("SELECT id FROM USERS WHERE User_ = @username");

    if (existing.recordset.length > 0) {
      res.status(400).json({ error: `User "${cleanUser}" already exists` });
      return;
    }

    await pool
      .request()
      .input("username", mssql.NVarChar, cleanUser)
      .input("password", mssql.NVarChar, cleanPass)
      .input("permetion", mssql.NVarChar, cleanPerm)
      .input("on_off", mssql.NVarChar, cleanOnOff)
      .query(
        "INSERT INTO USERS (User_, password, permetion, on_off) VALUES (@username, @password, @permetion, @on_off)"
      );

    logger.info({ username: cleanUser }, "User added");
    res.json({ success: true, message: `User "${cleanUser}" added successfully` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Failed to add user");
    res.status(500).json({ error: message });
  }
});

// 3. Update User
router.put("/users/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await checkDbConfigured(res))) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  const { user } = req.body as {
    user?: {
      User_?: unknown;
      password?: unknown;
      permetion?: unknown;
      on_off?: unknown;
    };
  };

  if (!user) {
    res.status(400).json({ error: "User payload is required" });
    return;
  }

  try {
    const pool = await getPool();

    const cleanUser = typeof user.User_ === "string" ? user.User_.trim() : undefined;
    const cleanPass = typeof user.password === "string" ? user.password.trim() : undefined;
    const cleanPerm = typeof user.permetion === "string" ? user.permetion.trim() : undefined;
    const cleanOnOff = typeof user.on_off === "string" ? user.on_off.trim() : undefined;

    // Check user exists
    const existing = await pool
      .request()
      .input("id", mssql.Int, id)
      .query("SELECT id, User_, password, permetion, on_off FROM USERS WHERE id = @id");

    if (existing.recordset.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const current = existing.recordset[0];
    const finalUser = cleanUser ?? current.User_;
    const finalPass = cleanPass ?? current.password;
    const finalPerm = cleanPerm ?? current.permetion;
    const finalOnOff = cleanOnOff ?? current.on_off;

    await pool
      .request()
      .input("id", mssql.Int, id)
      .input("username", mssql.NVarChar, finalUser)
      .input("password", mssql.NVarChar, finalPass)
      .input("permetion", mssql.NVarChar, finalPerm)
      .input("on_off", mssql.NVarChar, finalOnOff)
      .query(
        "UPDATE USERS SET User_ = @username, password = @password, permetion = @permetion, on_off = @on_off WHERE id = @id"
      );

    logger.info({ id, username: finalUser }, "User updated");
    res.json({ success: true, message: `User updated successfully` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, id }, "Failed to update user");
    res.status(500).json({ error: message });
  }
});

// 4. Delete User
router.delete("/users/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await checkDbConfigured(res))) return;

  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid user ID" });
    return;
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", mssql.Int, id)
      .query("DELETE FROM USERS WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    logger.info({ id }, "User deleted");
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, id }, "Failed to delete user");
    res.status(500).json({ error: message });
  }
});

export default router;
