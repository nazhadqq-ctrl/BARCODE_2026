import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  getSession,
  clearSession,
  getScannerSettings,
  saveScannerSettings,
  getSessionTimeoutSettings,
  saveSessionTimeoutSettings,
  type SqlConfig,
} from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ScannerModal } from "@/components/scanner-modal";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  ShieldCheck,
  Users,
  CheckCircle,
  Save,
  Trash2,
  UserPlus,
  ShieldAlert,
  Eye,
  EyeOff,
  LogOut,
  ScanLine,
  Zap,
  RefreshCw,
  Pencil,
  Search,
  AlertTriangle,
} from "lucide-react";

type Tab = "search" | "sql" | "admin" | "users" | "scanner";

const BTN_BLUE = "hsl(var(--primary))";

interface SqlUser {
  id: number;
  User_: string;
  password?: string;
  permetion?: string;
  on_off?: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground text-sm mb-1">{children}</div>;
}

function DarkInput({
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
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
        onChange={(e) => onChange(e.target.value)}
        type={isPassword && !show ? "password" : "text"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md px-4 py-3.5 text-foreground text-base outline-none
                   border border-border focus:border-primary transition-colors pr-11 bg-background"
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

function GreenBtn({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-semibold text-sm
                 text-primary-foreground bg-primary hover:bg-primary/90 transition-all
                 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
    >
      {children}
    </button>
  );
}

function BlueBtn({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-semibold text-sm
                 text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
      style={{ background: BTN_BLUE }}
    >
      {children}
    </button>
  );
}

type DbStatus = "unknown" | "checking" | "connected" | "offline";

export function AdminPage() {
  const [, navigate] = useLocation();
  const session = getSession();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("search");

  const [dbStatus, setDbStatus] = useState<DbStatus>("unknown");
  const didMount = useRef(false);

  const checkDb = useCallback(async () => {
    setDbStatus("checking");
    try {
      const res = await fetch("/api/sql/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbStatus("connected");
      } else {
        setDbStatus("offline");
      }
    } catch {
      setDbStatus("offline");
    }
  }, []);

  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;
    checkDb();
  }, [checkDb]);

  useEffect(() => {
    if (!session || session.role !== "admin") {
      navigate("/login");
    }
  }, [session, navigate]);

  if (!session || session.role !== "admin") return null;

  const tabs: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: "search", label: "Search", icon: Search },
    { id: "sql", label: "SQL Server", icon: Database },
    { id: "admin", label: "Admin Setup", icon: ShieldCheck },
    { id: "users", label: "User Management", icon: Users },
    { id: "scanner", label: "Scanner", icon: ScanLine },
  ];

  const handleSignOut = async () => {
    await clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full px-4 py-8 sm:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure SQL Server connection and manage users securely
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleSignOut}
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
              className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                activeTab === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "sql" && dbStatus !== "unknown" && (
                <span
                  title={
                    dbStatus === "connected"
                      ? "Database connected"
                      : dbStatus === "offline"
                      ? "Database offline"
                      : "Checking…"
                  }
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    dbStatus === "connected"
                      ? "bg-green-400"
                      : dbStatus === "offline"
                      ? "bg-red-400"
                      : "bg-yellow-400 animate-pulse"
                  }`}
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === "search" ? (
          <SearchTab />
        ) : (
          <div className="rounded-lg p-6 sm:p-8 bg-card border border-border">
            {activeTab === "sql" && <SqlTab toast={toast} dbStatus={dbStatus} onRecheck={checkDb} />}
            {activeTab === "admin" && <AdminTab session={session} />}
            {activeTab === "users" && <UsersTab toast={toast} session={session} />}
            {activeTab === "scanner" && <ScannerTab toast={toast} />}
          </div>
        )}
      </div>
    </div>
  );
}

function SearchTab() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ found: boolean; rows: Record<string, unknown>[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent, explicit?: string) => {
    if (e) e.preventDefault();
    const code = explicit ?? barcode;
    if (!code.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const res = await fetch("/api/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ barcode: code.trim() }),
      });

      if (res.status === 401) {
        toast({ title: "Session Expired", description: "Please log in again.", variant: "destructive" });
        navigate("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Lookup failed");
        return;
      }

      setResult(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
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
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium uppercase tracking-wider">
            or manually enter
          </span>
          <div className="flex-grow border-t border-border" />
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Enter barcode..."
            className="flex-1 rounded-md px-4 py-3.5 text-foreground text-base outline-none border border-border focus:border-primary transition-colors bg-background"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center w-14 h-14 rounded-md text-foreground shrink-0 disabled:opacity-50"
            style={{ background: BTN_BLUE }}
          >
            <Search className="w-5 h-5" />
          </button>
        </form>
      </div>

      <div className="flex flex-col gap-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {errorMsg && (
          <div className="rounded-md px-4 py-4 flex flex-col items-center gap-2 text-center border border-red-500/30 bg-destructive/10">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-red-300 font-medium text-sm">{errorMsg}</p>
          </div>
        )}

        {result && !result.found && (
          <div className="rounded-lg px-4 py-8 text-center text-muted-foreground font-medium border border-border">
            No results found for {barcode}
          </div>
        )}

        {result &&
          result.found &&
          result.rows.map((row: any, i: number) => (
            <div key={i} className="rounded-md overflow-hidden border border-border">
              <div className="px-4 py-2.5 flex justify-between items-center font-bold text-sm bg-muted">
                <span className="text-muted-foreground">Result {i + 1}</span>
                <span className="text-primary font-mono">{barcode}</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {Object.entries(row).map(([key, value]) => (
                  <div key={key} className="flex flex-col border-b border-border pb-2 last:border-0 last:pb-0">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      {key}
                    </span>
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
  toast,
  dbStatus,
  onRecheck,
}: {
  toast: ReturnType<typeof useToast>["toast"];
  dbStatus: DbStatus;
  onRecheck: () => void;
}) {
  const [config, setConfig] = useState<SqlConfig>({
    server: "",
    database: "",
    user: "",
    password: "",
    port: 1433,
    windowsAuth: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/sql/config", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.config) {
          setConfig({
            server: data.config.server || "",
            database: data.config.database || "",
            user: data.config.user || "",
            password: "",
            port: data.config.port || 1433,
            windowsAuth: data.config.windowsAuth || false,
            hasPassword: data.config.hasPassword,
          });
        }
      })
      .catch(() => {});
  }, []);

  const set = (patch: Partial<SqlConfig>) => setConfig((c) => ({ ...c, ...patch }));

  const handleTest = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sql/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Connected", description: "SQL Server connection successful." });
      } else {
        toast({ title: "Failed", description: data.error || data.message, variant: "destructive" });
      }
      onRecheck();
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
      onRecheck();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/sql/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Saved", description: "Configuration updated and connected on the server." });
        onRecheck();
      } else {
        toast({ title: "Save Failed", description: data.error || "Failed to connect", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusMeta = {
    unknown: {
      border: "border-border",
      bg: "rgba(30,42,58,0.6)",
      icon: <Database className="w-4 h-4 text-muted-foreground" />,
      text: "text-muted-foreground",
      label: "Not configured — enter details below",
    },
    checking: {
      border: "border-yellow-500/30",
      bg: "rgba(234,179,8,0.08)",
      icon: <RefreshCw className="w-4 h-4 text-yellow-400 animate-spin" />,
      text: "text-yellow-300",
      label: "Checking database connection…",
    },
    connected: {
      border: "border-green-500/30",
      bg: "rgba(34,197,94,0.08)",
      icon: <CheckCircle className="w-4 h-4 text-green-400" />,
      text: "text-green-300",
      label: "Database Connected (Server-Side)",
    },
    offline: {
      border: "border-red-500/30",
      bg: "rgba(239,68,68,0.08)",
      icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
      text: "text-red-300",
      label: "Database Offline",
    },
  }[dbStatus];

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">SQL Server Configuration</h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold">
          Server-Side Protected
        </span>
      </div>

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
            onClick={onRecheck}
            title="Re-check connection"
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div>
        <FieldLabel>Server IP / Hostname</FieldLabel>
        <DarkInput value={config.server} onChange={(v) => set({ server: v })} placeholder="e.g. localhost or 192.168.1.100" />
      </div>

      <div>
        <FieldLabel>Database Name</FieldLabel>
        <DarkInput value={config.database} onChange={(v) => set({ database: v })} />
      </div>

      <div>
        <FieldLabel>SQL Username</FieldLabel>
        <DarkInput value={config.user ?? ""} onChange={(v) => set({ user: v })} autoComplete="username" />
      </div>

      <div>
        <FieldLabel>
          SQL Password {config.hasPassword && <span className="text-xs text-muted-foreground font-normal">(Leave blank to keep existing)</span>}
        </FieldLabel>
        <DarkInput
          value={config.password ?? ""}
          onChange={(v) => set({ password: v })}
          type="password"
          placeholder={config.hasPassword ? "•••••••• (configured on server)" : "Enter SQL password"}
          autoComplete="current-password"
        />
      </div>

      <div>
        <FieldLabel>Port (default 1433)</FieldLabel>
        <input
          type="number"
          value={config.port || ""}
          onChange={(e) => set({ port: parseInt(e.target.value) || 1433 })}
          placeholder="1433"
          className="w-full rounded-md px-4 py-3.5 text-foreground text-base outline-none
                     border border-border focus:border-primary transition-colors bg-background"
        />
      </div>

      <div className="flex items-center justify-between rounded-md px-4 py-3 gap-4 border border-border">
        <div>
          <div className="text-foreground text-sm font-medium">Windows Authentication</div>
          <div className="text-muted-foreground text-xs mt-0.5">Use Windows login on the server</div>
        </div>
        <Switch
          checked={config.windowsAuth ?? false}
          onCheckedChange={(val) => set({ windowsAuth: val })}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <GreenBtn type="submit" disabled={loading}>
          <Save className="w-4 h-4" /> Save to Server
        </GreenBtn>
        <BlueBtn type="button" onClick={handleTest} disabled={loading}>
          <Zap className="w-4 h-4" /> Test Connection
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
        <div className="rounded-md px-4 py-4 flex flex-col gap-1 border border-border bg-muted/40">
          <div className="text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
            Logged in as
          </div>
          <div className="text-foreground text-lg font-bold">{session.username}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <ShieldAlert className="w-3.5 h-3.5 text-primary" />
            <span className="text-primary text-sm font-semibold uppercase">{session.role}</span>
          </div>
        </div>
      )}
      <div className="rounded-md px-4 py-3 text-sm text-muted-foreground border border-border">
        Users and credentials are now secured server-side. Database credentials are encrypted and stored in the server environment.
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
  const [dbError, setDbError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const res = await fetch("/api/users/list", { credentials: "include" });
      const data = (await res.json()) as { users?: SqlUser[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setUsers(data.users ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load users";
      setDbError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openAdd = () => {
    setFormName("");
    setFormPassword("");
    setFormPermetion("user");
    setFormOnOff("yes");
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
    if (!formName.trim()) {
      toast({ title: "Error", description: "Username required", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/users/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user: {
            User_: formName.trim(),
            password: formPassword.trim(),
            permetion: formPermetion,
            on_off: formOnOff,
          },
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
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
        credentials: "include",
        body: JSON.stringify({
          user: {
            User_: formName.trim(),
            password: formPassword.trim(),
            permetion: formPermetion,
            on_off: formOnOff,
          },
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
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
        credentials: "include",
        body: JSON.stringify({
          user: {
            User_: u.User_,
            password: u.password ?? "",
            permetion: u.permetion,
            on_off: newVal,
          },
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, on_off: newVal } : x)));
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
        credentials: "include",
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
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
        <label className="text-sm font-medium">Username</label>
        <input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          required
          className="border border-input rounded-md px-3 py-2 bg-background text-foreground"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Password</label>
        <input
          type="password"
          value={formPassword}
          onChange={(e) => setFormPassword(e.target.value)}
          placeholder="Enter password"
          className="border border-input rounded-md px-3 py-2 bg-background text-foreground"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Permission</label>
        <Select value={formPermetion} onValueChange={setFormPermetion}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
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
        <Switch checked={formOnOff === "yes"} onCheckedChange={(val) => setFormOnOff(val ? "yes" : "no")} />
      </div>
      <BlueBtn type="submit">{submitLabel}</BlueBtn>
    </form>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage database users and permissions</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <BlueBtn onClick={openAdd}>
                <UserPlus className="w-4 h-4" /> Add User
              </BlueBtn>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
              </DialogHeader>
              <UserForm onSubmit={handleAdd} submitLabel="Add User" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {dbError ? (
        <div className="rounded-md px-4 py-6 text-center text-muted-foreground border border-border">
          {dbError.includes("not configured")
            ? "Configure SQL Server in the SQL Server tab first, then return here to manage users."
            : dbError}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Username</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Active</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{u.User_}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                        u.permetion === "admin"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {u.permetion || "user"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleOnOff(u)}
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        u.on_off === "yes"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {u.on_off === "yes" ? "Active" : "Blocked"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Dialog
                        open={editUser?.id === u.id}
                        onOpenChange={(open) => {
                          if (!open) setEditUser(null);
                        }}
                      >
                        <DialogTrigger asChild>
                          <button
                            onClick={() => openEdit(u)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                          </DialogHeader>
                          <UserForm onSubmit={handleEdit} submitLabel="Save Changes" />
                        </DialogContent>
                      </Dialog>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No users found in database
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScannerTab({ toast }: { toast: ReturnType<typeof useToast>["toast"] }) {
  const [scannerSettings, setScannerSettings] = useState(getScannerSettings());
  const [sessionTimeout, setSessionTimeout] = useState(getSessionTimeoutSettings());

  const handleSaveScanner = () => {
    saveScannerSettings(scannerSettings);
    toast({ title: "Saved", description: "Scanner settings updated." });
  };

  const handleSaveTimeout = () => {
    saveSessionTimeoutSettings(sessionTimeout);
    toast({ title: "Saved", description: "Session timeout updated." });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-foreground">Scanner Settings</h2>
        <div className="flex items-center justify-between border border-border p-4 rounded-md">
          <div>
            <label className="text-sm font-medium">Auto Torch</label>
            <p className="text-xs text-muted-foreground">Automatically turn on flashlight when scanner opens</p>
          </div>
          <Switch
            checked={scannerSettings.autoTorch}
            onCheckedChange={(val) => setScannerSettings({ autoTorch: val })}
          />
        </div>
        <GreenBtn onClick={handleSaveScanner}>
          <Save className="w-4 h-4" /> Save Scanner Settings
        </GreenBtn>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-6">
        <h2 className="text-xl font-bold text-foreground">Session Timeout</h2>
        <div className="flex flex-col gap-2">
          <FieldLabel>Auto Sign-out Inactivity Timeout (minutes)</FieldLabel>
          <input
            type="number"
            min={1}
            max={120}
            value={sessionTimeout.timeoutMinutes}
            onChange={(e) =>
              setSessionTimeout({ timeoutMinutes: parseInt(e.target.value) || 15 })
            }
            className="w-full rounded-md px-4 py-3 text-foreground border border-border bg-background"
          />
        </div>
        <GreenBtn onClick={handleSaveTimeout}>
          <Save className="w-4 h-4" /> Save Timeout Settings
        </GreenBtn>
      </div>
    </div>
  );
}
