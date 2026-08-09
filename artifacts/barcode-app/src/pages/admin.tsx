import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  getSession, getSqlConfig, saveSqlConfig,
  getScannerSettings, saveScannerSettings,
  getSessionTimeoutSettings, saveSessionTimeoutSettings,
  SqlConfig, trimSqlConfig,
} from "@/lib/store";
import { useTestSqlConnection, useRunBarcodeQuery } from "@workspace/api-client-react";
import type { ConnectionTestResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScannerModal } from "@/components/scanner-modal";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Database, ShieldCheck, Users, CheckCircle, Save,
  Trash2, UserPlus, ShieldAlert, Eye, EyeOff, LogOut, ScanLine,
  Zap, RefreshCw, Pencil, Search, AlertTriangle,
} from "lucide-react";

type Tab = "search" | "sql" | "admin" | "users" | "scanner";

const BTN_GREEN = "hsl(var(--primary))";
const BTN_BLUE = "hsl(var(--primary))";

interface SqlUser {
  id: number;
  User_: string;
  password: string;
  permetion: string;
  on_off: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground text-sm mb-1">{children}</div>;
}

function DarkInput({
  value, onChange, type = "text", placeholder, autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="relative">
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        type={isPassword && !show ? "password" : "text"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md px-3 py-2 text-foreground text-sm outline-none
                   border border-border focus:border-primary transition-colors bg-background"
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow(s => !s)}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

function GreenBtn({ onClick, disabled, children }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-primary-foreground text-sm
                 transition-opacity disabled:opacity-50 shrink-0 bg-primary hover:bg-primary/90"
    >
      {children}
    </button>
  );
}

function BlueBtn({ type = "button", onClick, disabled, children }: {
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-secondary-foreground text-sm shrink-0 disabled:opacity-50 bg-secondary hover:bg-secondary/80"
    >
      {children}
    </button>
  );
}

type DbStatus = "unknown" | "checking" | "connected" | "offline";

function SuperAdminLogin({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "Nazhad" && password === "Nn!@#123") {
      onLogin();
    } else {
      setError("Invalid username or password");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto my-8 p-6 border border-border rounded-lg bg-background shadow-sm">
      <div className="flex flex-col items-center gap-2 mb-2">
        <ShieldAlert className="w-8 h-8 text-primary" />
        <h2 className="text-xl font-bold text-center">Authentication Required</h2>
        <p className="text-sm text-muted-foreground text-center">Enter the master credentials to access settings.</p>
      </div>
      {error && <div className="text-destructive text-sm font-medium text-center bg-destructive/10 py-2 rounded-md">{error}</div>}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Username</label>
        <Input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Password</label>
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="mt-2 w-full">Login</Button>
    </form>
  );
}

export function AdminPage() {
  const [, navigate] = useLocation();
  const session = getSession();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // ── DB connection status (shared across tab list dot + SqlTab banner) ──
  const [dbStatus, setDbStatus] = useState<DbStatus>("unknown");
  const testConn = useTestSqlConnection();
  const didMount = useRef(false);

  const checkDb = useCallback((overrideConfig?: SqlConfig) => {
    const cfg = overrideConfig ?? getSqlConfig();
    const cleanCfg = trimSqlConfig(cfg);
    if (!cleanCfg.server || !cleanCfg.database) { setDbStatus("unknown"); return; }
    setDbStatus("checking");
    testConn.mutate(
      { data: { ...cleanCfg, port: cleanCfg.port ?? 1433 } },
      {
        onSuccess: (d: ConnectionTestResult) => setDbStatus(d.success ? "connected" : "offline"),
        onError: () => setDbStatus("offline"),
      },
    );
  }, [testConn]);

  // Auto-check on first render
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    checkDb();
  }, [checkDb]);

  const tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "sql", label: "SQL Server", icon: Database },
    { id: "admin", label: "Admin Setup", icon: ShieldCheck },
    { id: "users", label: "User Management", icon: Users },
    { id: "scanner", label: "Scanner", icon: ScanLine },
  ];

  return (
    <div className="min-h-screen w-full px-4 py-8 sm:px-8" >
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure SQL Server connection and manage users
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => { localStorage.removeItem("ba_session"); navigate("/login"); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-muted-foreground
                         hover:text-foreground hover:bg-muted transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              style={{
                color: activeTab === id ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "sql" && dbStatus !== "unknown" && (
                <span
                  title={
                    dbStatus === "connected" ? "Database connected" :
                      dbStatus === "offline" ? "Database offline" :
                        "Checking…"
                  }
                  className={`w-2 h-2 rounded-full shrink-0 ${dbStatus === "connected" ? "bg-green-400" :
                      dbStatus === "offline" ? "bg-red-400" :
                        "bg-yellow-400 animate-pulse"
                    }`}
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === "search"
          ? <SearchTab />
          : (
            <div className="rounded-lg p-6 sm:p-8 bg-card" >
              {!isSuperAdmin ? (
                <SuperAdminLogin onLogin={() => setIsSuperAdmin(true)} />
              ) : (
                <>
                  {activeTab === "sql" && <SqlTab toast={toast} testConn={testConn} dbStatus={dbStatus} onRecheck={checkDb} />}
                  {activeTab === "admin" && <AdminTab session={session} />}
                  {activeTab === "users" && <UsersTab toast={toast} session={session} />}
                  {activeTab === "scanner" && <ScannerTab toast={toast} />}
                </>
              )}
            </div>
          )
        }

      </div>
    </div>
  );
}

function SearchTab() {
  const { toast } = useToast();
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const sqlConfig = getSqlConfig();
  const runQuery = useRunBarcodeQuery();

  const handleSearch = (e?: React.FormEvent, explicit?: string) => {
    if (e) e.preventDefault();
    const code = explicit ?? barcode;
    if (!code) return;
    const cleanConfig = trimSqlConfig(sqlConfig);
    if (!cleanConfig.server || !cleanConfig.database) {
      toast({ title: "Configuration Missing", description: "Save SQL Server settings first.", variant: "destructive" });
      return;
    }
    runQuery.mutate({ data: { connection: cleanConfig, barcode: code.trim() } });
  };

  const handleDecode = (text: string) => {
    setBarcode(text);
    handleSearch(undefined, text);
  };

  return (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-4">
        <Button
          onClick={() => setScannerOpen(true)}
          className="w-full h-auto py-6 text-base font-medium rounded-lg shadow-sm border border-border flex flex-col gap-2"
        >
          <ScanLine className="w-6 h-6" />
          SCAN BARCODE
        </Button>

        <div className="relative flex items-center">
          <div className="flex-grow border-t border-border" />
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium uppercase tracking-wider">or manually enter</span>
          <div className="flex-grow border-t border-border" />
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            placeholder="Enter barcode..."
            className="flex-1 rounded-md px-4 py-3.5 text-foreground text-base outline-none border border-border focus:border-primary transition-colors"

          />
          <button
            type="submit"
            disabled={runQuery.isPending}
            className="flex items-center justify-center w-14 h-14 rounded-md text-foreground shrink-0 disabled:opacity-50"
            style={{ background: BTN_BLUE }}
          >
            <Search className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        {runQuery.isPending && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {runQuery.isError && (
          <div className="rounded-md px-4 py-4 flex flex-col items-center gap-2 text-center border border-red-500/30"
            style={{ background: "rgba(239,68,68,0.1)" }}>
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-red-300 font-medium text-sm">
              {runQuery.error instanceof Error
                ? runQuery.error.message.replace(/^HTTP \d+ [^:]+:\s*/, "")
                : "Lookup failed"}
            </p>
          </div>
        )}

        {runQuery.isSuccess && !runQuery.data.found && (
          <div className="rounded-lg px-4 py-8 text-center text-muted-foreground font-medium border border-border">
            No results found for {barcode}
          </div>
        )}

        {runQuery.isSuccess && runQuery.data.found && runQuery.data.rows.map((row: any, i: number) => (
          <div key={i} className="rounded-md overflow-hidden border border-border">
            <div className="px-4 py-2.5 flex justify-between items-center font-bold text-sm"
            >
              <span className="text-muted-foreground">Result {i + 1}</span>
              <span className="text-blue-400 font-mono">{barcode}</span>
            </div>
            <div className="p-4 flex flex-col gap-3" >
              {Object.entries(row).map(([key, value]) => (
                <div key={key} className="flex flex-col border-b border-border pb-2 last:border-0 last:pb-0">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">{key}</span>
                  <span className="text-foreground font-medium break-words mt-0.5">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ScannerModal open={scannerOpen} onOpenChange={setScannerOpen} onDecode={handleDecode} />
    </div>
  );
}

function SqlTab({
  toast, testConn, dbStatus, onRecheck,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  testConn: ReturnType<typeof useTestSqlConnection>;
  dbStatus: DbStatus;
  onRecheck: (cfg?: SqlConfig) => void;
}) {
  const [config, setConfig] = useState<SqlConfig>(getSqlConfig());

  const set = (patch: Partial<SqlConfig>) => setConfig(c => ({ ...c, ...patch }));

  const handleTest = () => {
    const cleanConfig = trimSqlConfig(config);
    setConfig(cleanConfig);
    const cfg = { ...cleanConfig, port: Number(cleanConfig.port) || 1433 };
    testConn.mutate({ data: cfg }, {
      onSuccess: (data: ConnectionTestResult) => {
        if (data.success) {
          toast({ title: "Connected", description: "SQL Server connection successful." });
        } else {
          toast({ title: "Failed", description: data.message, variant: "destructive" });
        }
        onRecheck(cfg);
      },
      onError: (err: unknown) => {
        const raw = err instanceof Error ? err.message : "Connection failed";
        toast({ title: "Connection Failed", description: raw.replace(/^HTTP \d+ [^:]+:\s*/, ""), variant: "destructive" });
        onRecheck(cfg);
      },
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanConfig = trimSqlConfig(config);
    setConfig(cleanConfig);
    const cfg = { ...cleanConfig, port: Number(cleanConfig.port) || 1433 };
    saveSqlConfig(cfg);
    toast({ title: "Saved", description: "Configuration saved to this device." });
    onRecheck(cfg);
  };

  // ── Status colours ───────────────────────────────────────────────────────
  const statusMeta = {
    unknown: { border: "border-border", bg: "rgba(30,42,58,0.6)", icon: <Database className="w-4 h-4 text-muted-foreground" />, text: "text-muted-foreground", label: "Not configured — enter details below" },
    checking: { border: "border-yellow-500/30", bg: "rgba(234,179,8,0.08)", icon: <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />, text: "text-yellow-300", label: "Checking database connection…" },
    connected: { border: "border-green-500/30", bg: "rgba(34,197,94,0.08)", icon: <CheckCircle className="w-4 h-4 text-green-400" />, text: "text-green-300", label: "Database Connected" },
    offline: { border: "border-red-500/30", bg: "rgba(239,68,68,0.08)", icon: <AlertTriangle className="w-4 h-4 text-red-400" />, text: "text-red-300", label: "Database Offline" },
  }[dbStatus];

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-foreground">SQL Server Configuration</h2>

      {/* ── Live DB status banner ─────────────────────────────────────── */}
      <div
        className={`rounded-md px-4 py-3 flex items-center justify-between gap-3 border ${statusMeta.border}`}
        style={{ background: statusMeta.bg }}
      >
        <div className="flex items-center gap-2.5">
          {statusMeta.icon}
          <span className={`text-sm font-medium ${statusMeta.text}`}>{statusMeta.label}</span>
        </div>
        {dbStatus !== "unknown" && dbStatus !== "checking" && (
          <button
            type="button"
            onClick={() => onRecheck(config)}
            title="Re-check connection"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:hover:bg-muted shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div>
        <FieldLabel>Server IP / Hostname</FieldLabel>
        <DarkInput value={config.server} onChange={v => set({ server: v })} placeholder="e.g. 192.168.1.100" />
      </div>

      <div>
        <FieldLabel>Database Name</FieldLabel>
        <DarkInput value={config.database} onChange={v => set({ database: v })} />
      </div>

      <div>
        <FieldLabel>SQL Username</FieldLabel>
        <DarkInput value={config.user} onChange={v => set({ user: v })} autoComplete="username" />
      </div>

      <div>
        <FieldLabel>SQL Password</FieldLabel>
        <DarkInput value={config.password} onChange={v => set({ password: v })} type="password" autoComplete="current-password" />
      </div>

      <div>
        <FieldLabel>Port (default 1433)</FieldLabel>
        <input
          type="number"
          value={config.port || ""}
          onChange={e => set({ port: parseInt(e.target.value) || 1433 })}
          placeholder="1433"
          className="w-full rounded-md px-4 py-3.5 text-foreground text-base outline-none
                     border border-border focus:border-primary transition-colors"

        />
      </div>

      <div
        className="flex items-center justify-between rounded-md px-4 py-3 gap-4"

      >
        <div>
          <div className="text-foreground text-sm font-medium">Windows Authentication</div>
          <div className="text-muted-foreground text-xs mt-0.5">Use Windows login instead of SQL credentials</div>
        </div>
        <Switch
          checked={config.windowsAuth ?? false}
          onCheckedChange={val => set({ windowsAuth: val })}
        />
      </div>

      {testConn.isError && (
        <div className="rounded-md px-4 py-3 text-sm text-red-300 border border-red-500/30 break-words"
          style={{ background: "rgba(239,68,68,0.1)" }}>
          {(testConn.error instanceof Error ? testConn.error.message : "Unknown error")
            .replace(/^HTTP \d+ [^:]+:\s*/, "")}
        </div>
      )}
      {testConn.isSuccess && testConn.data.success && (
        <div className="rounded-md px-4 py-3 text-sm text-green-300 border border-green-500/30 font-medium"
          style={{ background: "rgba(34,197,94,0.1)" }}>
          Connection successful
        </div>
      )}

      <div className="flex gap-3 pt-1 flex-wrap">
        <GreenBtn onClick={handleTest} disabled={testConn.isPending}>
          <CheckCircle className="w-4 h-4" />
          {testConn.isPending ? "Testing..." : "Test Connection"}
        </GreenBtn>
        <BlueBtn type="submit">
          <Save className="w-4 h-4" />
          Save Configuration
        </BlueBtn>
      </div>
    </form>
  );
}

function AdminTab({ session }: { session: { username: string; role: string } | null }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-foreground">Admin Setup</h2>
      {session && (
        <div className="rounded-md px-4 py-4 flex flex-col gap-1" >
          <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">Logged in as</div>
          <div className="text-foreground text-lg font-bold">{session.username}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-blue-400 text-sm font-semibold uppercase">{session.role}</span>
          </div>
        </div>
      )}
      <div className="rounded-md px-4 py-3 text-sm text-muted-foreground border border-border" >
        Users are managed via the <span className="text-foreground font-medium">USERS</span> table in your SQL Server database.
        Use the <span className="text-foreground font-medium">User Management</span> tab to add, enable, or disable users.
      </div>
    </div>
  );
}

const TIMEOUT_OPTIONS = [
  { label: "Disabled", value: 0 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
];

function ScannerTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [settings, setSettings] = useState(getScannerSettings());
  const [timeoutSettings, setTimeoutSettings] = useState(getSessionTimeoutSettings());

  const toggle = (key: keyof ReturnType<typeof getScannerSettings>, val: boolean) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveScannerSettings(next);
    toast({ title: "Saved", description: "Scanner settings updated." });
  };

  const handleTimeoutChange = (val: string) => {
    const next = { timeoutMinutes: Number(val) };
    setTimeoutSettings(next);
    saveSessionTimeoutSettings(next);
    toast({
      title: "Saved",
      description: next.timeoutMinutes === 0
        ? "Session timeout disabled."
        : `Users will be logged out after ${TIMEOUT_OPTIONS.find(o => o.value === next.timeoutMinutes)?.label} of inactivity.`,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-foreground">Scanner & Session Settings</h2>
      <p className="text-muted-foreground text-sm -mt-2">
        Configure scanner behaviour and automatic logout for inactivity.
      </p>

      <div
        className="flex items-center justify-between rounded-md px-4 py-4 gap-4"

      >
        <div>
          <div className="text-foreground text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-foreground" />
            Auto Flashlight
          </div>
          <div className="text-muted-foreground text-xs mt-0.5">
            Automatically turn on the torch every time the scanner opens
          </div>
        </div>
        <Switch
          checked={settings.autoTorch}
          onCheckedChange={(val) => toggle("autoTorch", val)}
        />
      </div>

      <div className="rounded-md px-4 py-3 text-xs text-muted-foreground border border-border" >
        Note: Flashlight is only available on devices that support torch mode (most Android phones). It will be ignored silently on unsupported devices.
      </div>

      <div className="border-t border-border pt-5 flex flex-col gap-3">
        <div>
          <div className="text-foreground text-sm font-medium mb-0.5">Auto Logout (Inactivity Timeout)</div>
          <div className="text-muted-foreground text-xs">
            Automatically log users out after a period of no activity. A 60-second warning appears before logout.
          </div>
        </div>
        <Select
          value={String(timeoutSettings.timeoutMinutes)}
          onValueChange={handleTimeoutChange}
        >
          <SelectTrigger
            className="rounded-md border-border text-foreground"

          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEOUT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function UsersTab({
  toast,
  session,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  session: { username: string } | null;
}) {
  const [users, setUsers] = useState<SqlUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<SqlUser | null>(null);

  const [formName, setFormName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPermetion, setFormPermetion] = useState("user");
  const [formOnOff, setFormOnOff] = useState<"yes" | "no">("yes");

  const sqlConfig = trimSqlConfig(getSqlConfig());
  const isConfigured = !!(sqlConfig.server && sqlConfig.database);

  const loadUsers = useCallback(async () => {
    if (!isConfigured) return;
    const currentConfig = trimSqlConfig(getSqlConfig());
    setLoading(true);
    try {
      const res = await fetch("/api/users/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: currentConfig }),
      });
      const data = await res.json() as { users?: SqlUser[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setUsers(data.users ?? []);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isConfigured, toast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openAdd = () => {
    setFormName(""); setFormPassword(""); setFormPermetion("user"); setFormOnOff("yes");
    setAddOpen(true);
  };

  const openEdit = (u: SqlUser) => {
    setFormName(u.User_);
    setFormPassword(u.password ?? "");
    setFormPermetion(u.permetion || "user");
    setFormOnOff((u.on_off ?? "no").toLowerCase() === "yes" ? "yes" : "no");
    setEditUser(u);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) { toast({ title: "Error", description: "Username required", variant: "destructive" }); return; }
    try {
      const res = await fetch("/api/users/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: sqlConfig, user: { User_: formName.trim(), password: formPassword.trim(), permetion: formPermetion, on_off: formOnOff } }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add");
      toast({ title: "User Added" });
      setAddOpen(false);
      await loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: sqlConfig, user: { User_: formName.trim(), password: formPassword.trim(), permetion: formPermetion, on_off: formOnOff } }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      toast({ title: "User Updated" });
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleToggleOnOff = async (u: SqlUser) => {
    const newVal = u.on_off?.toLowerCase() === "yes" ? "no" : "yes";
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: sqlConfig, user: { User_: u.User_, password: u.password ?? "", permetion: u.permetion, on_off: newVal } }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, on_off: newVal } : x));
      toast({ title: newVal === "yes" ? "User Enabled" : "User Disabled" });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async (u: SqlUser) => {
    if (session && u.User_ === session.username) {
      toast({ title: "Error", description: "Cannot delete your own account", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: sqlConfig }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");
      toast({ title: "User Deleted" });
      await loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const UserForm = ({ onSubmit, submitLabel }: { onSubmit: (e: React.FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 mt-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Username (User_)</label>
        <input
          value={formName}
          onChange={e => setFormName(e.target.value)}
          required
          className="border border-input rounded-md px-3 py-2 bg-background text-foreground"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={formPassword}
          onChange={e => setFormPassword(e.target.value)}
          placeholder="Enter password"
          className="border border-input rounded-md px-3 py-2 bg-background text-foreground"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Permission (permetion)</label>
        <Select value={formPermetion} onValueChange={setFormPermetion}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between border p-3 rounded-md">
        <div>
          <label className="text-sm font-medium">Active (on_off)</label>
          <p className="text-xs text-muted-foreground">
            {formOnOff === "yes" ? "User can log in" : "User is blocked"}
          </p>
        </div>
        <Switch
          checked={formOnOff === "yes"}
          onCheckedChange={val => setFormOnOff(val ? "yes" : "no")}
        />
      </div>
      <BlueBtn type="submit">{submitLabel}</BlueBtn>
    </form>
  );

  if (!isConfigured) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">User Management</h2>
        <div className="rounded-md px-4 py-6 text-center text-muted-foreground" >
          Configure SQL Server connection first, then come back to manage users.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-bold text-foreground">User Management</h2>
        <div className="flex gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-muted-foreground
                       hover:text-foreground hover:hover:bg-muted transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <BlueBtn onClick={openAdd}><UserPlus className="w-4 h-4" /> Add User</BlueBtn>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
              <UserForm onSubmit={handleAdd} submitLabel="Add User" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="text-xs text-muted-foreground -mt-2">
        Table: <span className="text-foreground font-mono">USERS</span> ·
        Login is controlled by <span className="text-foreground font-mono">on_off</span> = <span className="text-green-400">yes</span> / <span className="text-red-400">no</span> ·
        Role from <span className="text-foreground font-mono">permetion</span>
      </div>

      <div className="rounded-md overflow-hidden" >
        {loading && users.length === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr >
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Username</th>
                <th className="text-left px-4 py-3 text-muted-foreground font-medium">Permission</th>
                <th className="text-center px-4 py-3 text-muted-foreground font-medium">Active</th>
                <th className="text-right px-4 py-3 text-muted-foreground font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => (
                <tr key={user.id} className={i > 0 ? "border-t border-background" : ""}>
                  <td className="px-4 py-3 text-foreground font-medium">{user.User_}</td>
                  <td className="px-4 py-3">
                    {(user.permetion ?? "").toLowerCase() === "admin"
                      ? <span className="inline-flex items-center gap-1 bg-blue-600 text-foreground px-2 py-0.5 rounded text-xs font-bold">
                        <ShieldAlert className="w-3 h-3" />ADMIN
                      </span>
                      : <span className="text-muted-foreground">{user.permetion || "user"}</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleOnOff(user)} className="inline-flex items-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${(user.on_off ?? "").toLowerCase() === "yes"
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                        }`}>
                        {(user.on_off ?? "no").toUpperCase()}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Dialog open={editUser?.id === user.id} onOpenChange={open => { if (!open) setEditUser(null); }}>
                        <DialogTrigger asChild>
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:hover:bg-muted transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
                          <UserForm onSubmit={handleEdit} submitLabel="Save Changes" />
                        </DialogContent>
                      </Dialog>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={!!session && user.User_ === session.username}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No users found in USERS table</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
