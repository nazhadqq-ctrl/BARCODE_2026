import { z } from "zod";

export const UserSchema = z.object({
  id: z.string(),
  username: z.string().min(1),
  password: z.string().min(1),
  role: z.enum(["admin", "user"]),
  canSearch: z.boolean(),
});

export type User = z.infer<typeof UserSchema>;

export const SqlConfigSchema = z.object({
  server: z.string(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  port: z.number().default(1433),
  windowsAuth: z.boolean().default(false),
});

export type SqlConfig = z.infer<typeof SqlConfigSchema>;

export const SessionSchema = z.object({
  username: z.string(),
  role: z.enum(["admin", "user"]),
  canSearch: z.boolean(),
});

export type Session = z.infer<typeof SessionSchema>;

export const initStore = () => {
  if (!localStorage.getItem("ba_users")) {
    const defaultUser: User = {
      id: "1",
      username: "admin",
      password: "admin123",
      role: "admin",
      canSearch: true,
    };
    localStorage.setItem("ba_users", JSON.stringify([defaultUser]));
  }
};

export const getUsers = (): User[] => {
  const data = localStorage.getItem("ba_users");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem("ba_users", JSON.stringify(users));
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

export const getSqlConfig = (): SqlConfig => {
  const data = localStorage.getItem("ba_sql_config");
  const defaults: SqlConfig = {
    server: "",
    database: "",
    user: "",
    password: "",
    port: 1433,
    windowsAuth: false,
  };
  if (!data) return defaults;
  try {
    return { ...defaults, ...JSON.parse(data) };
  } catch {
    return defaults;
  }
};

export const saveSqlConfig = (config: SqlConfig) => {
  localStorage.setItem("ba_sql_config", JSON.stringify(config));
};

export const getScannerSettings = () => {
  const data = localStorage.getItem("ba_scanner_settings");
  const defaults = { autoTorch: false };
  if (!data) return defaults;
  try { return { ...defaults, ...JSON.parse(data) }; }
  catch { return defaults; }
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
  try { return { ...defaults, ...JSON.parse(data) }; }
  catch { return defaults; }
};

export const saveSessionTimeoutSettings = (settings: SessionTimeoutSettings) => {
  localStorage.setItem("ba_session_timeout", JSON.stringify(settings));
};
