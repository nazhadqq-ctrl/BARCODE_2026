import { z } from "zod";

export const SqlConfigSchema = z.object({
  server: z.string(),
  database: z.string(),
  user: z.string().optional(),
  password: z.string().optional(),
  port: z.number().default(1433),
  windowsAuth: z.boolean().default(false),
  hasPassword: z.boolean().optional(),
});

export type SqlConfig = z.infer<typeof SqlConfigSchema>;

export const SessionSchema = z.object({
  username: z.string(),
  role: z.enum(["admin", "user"]),
  canSearch: z.boolean(),
});

export type Session = z.infer<typeof SessionSchema>;

export const initStore = () => {
  // Clean up any legacy sensitive data from localStorage
  try {
    localStorage.removeItem("ba_users");
    localStorage.removeItem("ba_sql_config");
  } catch {}
};

export const getSession = (): Session | null => {
  const data = localStorage.getItem("ba_session");
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const saveSession = (session: Session | null) => {
  if (session) {
    localStorage.setItem("ba_session", JSON.stringify(session));
  } else {
    localStorage.removeItem("ba_session");
  }
};

export const clearSession = async () => {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {}
  saveSession(null);
};

export const getScannerSettings = () => {
  const data = localStorage.getItem("ba_scanner_settings");
  const defaults = { autoTorch: false };
  if (!data) return defaults;
  try {
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return defaults;
  }
};

export const saveScannerSettings = (settings: { autoTorch: boolean }) => {
  localStorage.setItem("ba_scanner_settings", JSON.stringify(settings));
};

export interface SessionTimeoutSettings {
  timeoutMinutes: number;
}

export const getSessionTimeoutSettings = (): SessionTimeoutSettings => {
  const data = localStorage.getItem("ba_session_timeout");
  const defaults: SessionTimeoutSettings = { timeoutMinutes: 15 };
  if (!data) return defaults;
  try {
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return defaults;
  }
};

export const saveSessionTimeoutSettings = (settings: SessionTimeoutSettings) => {
  localStorage.setItem("ba_session_timeout", JSON.stringify(settings));
};
