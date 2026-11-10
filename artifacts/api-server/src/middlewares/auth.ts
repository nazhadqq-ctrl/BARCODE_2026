import type { Request, Response, NextFunction } from "express";
import { verifyToken, type UserPayload } from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  // 1. From httpOnly cookie
  if (req.cookies && typeof req.cookies["auth_token"] === "string") {
    return req.cookies["auth_token"];
  }

  // 2. From Authorization header
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ error: "Invalid or expired session token" });
    return;
  }

  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Administrator privileges required" });
      return;
    }
    next();
  });
}

