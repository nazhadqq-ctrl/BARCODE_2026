import jwt from "jsonwebtoken";

export interface UserPayload {
  id?: number;
  username: string;
  role: "admin" | "user";
  canSearch: boolean;
}

const secretFromEnv = process.env.JWT_SECRET;
if (!secretFromEnv || secretFromEnv.length < 16) {
  throw new Error("SECURITY FATAL: JWT_SECRET must be set in .env with at least 16 characters.");
}
const JWT_SECRET: string = secretFromEnv;
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"];

export function signToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || typeof decoded !== "object") return null;

    const p = decoded as Record<string, unknown>;
    if (typeof p["username"] !== "string" || typeof p["role"] !== "string") {
      return null;
    }

    return {
      id: typeof p["id"] === "number" ? p["id"] : undefined,
      username: p["username"],
      role: p["role"] === "admin" ? "admin" : "user",
      canSearch: Boolean(p["canSearch"]),
    };
  } catch {
    return null;
  }
}

