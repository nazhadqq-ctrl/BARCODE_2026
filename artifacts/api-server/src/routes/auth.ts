import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import * as mssql from "mssql";
import { signToken, type UserPayload } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";
import { isConfigured, getPool } from "../lib/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again after 15 minutes." },
});

const defaultAdminUser = (process.env.DEFAULT_ADMIN_USER || "admin").trim();
const defaultAdminPass = (process.env.DEFAULT_ADMIN_PASSWORD || "Admin@Secure2026!").trim();

router.post("/auth/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: unknown; password?: unknown };

  if (typeof username !== "string" || !username.trim() || typeof password !== "string") {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const cleanUser = username.trim();
  const cleanPass = password;

  // 1. Check if default super admin credentials match
  if (cleanUser === defaultAdminUser && cleanPass === defaultAdminPass) {
    const userPayload: UserPayload = {
      username: defaultAdminUser,
      role: "admin",
      canSearch: true,
    };

    const token = signToken(userPayload);
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 3600 * 1000, // 8 hours
      path: "/",
    });

    res.json({ success: true, user: userPayload });
    return;
  }

  // 2. If DB is configured, check against USERS table
  if (isConfigured()) {
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input("username", mssql.NVarChar, cleanUser)
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

      if (user.on_off?.toLowerCase() === "no") {
        res.status(403).json({ error: "Account is disabled. Contact your administrator." });
        return;
      }

      // Check password
      if (user.password !== cleanPass) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      const perm = (user.permetion ?? "").toLowerCase();
      const role =
        perm === "admin" || perm === "12345" || user.User_.toLowerCase() === "admin"
          ? "admin"
          : "user";
      const userPayload: UserPayload = {
        id: user.id,
        username: user.User_,
        role,
        canSearch: true,
      };

      const token = signToken(userPayload);
      res.cookie("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 3600 * 1000,
        path: "/",
      });

      res.json({ success: true, user: userPayload });
      return;
    } catch (err) {
      logger.error({ err }, "Database login query failed");
      res.status(500).json({ error: "Database error during login" });
      return;
    }
  }

  res.status(401).json({ error: "Invalid username or password" });
});

router.post("/auth/logout", (_req: Request, res: Response): void => {
  res.clearCookie("auth_token", { path: "/" });
  res.json({ success: true, message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, (req: Request, res: Response): void => {
  res.json({ success: true, user: req.user });
});

export default router;

