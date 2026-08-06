import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import logo from "@/assets/logo.png";
import { getSession, saveSession, getSqlConfig, trimSqlConfig } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function LoginPage() {
  const [, navigate] = useLocation();
  const session = getSession();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      navigate(session.role === "admin" ? "/admin" : "/search");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const sqlConfig = trimSqlConfig(getSqlConfig());
    if (!sqlConfig.server || !sqlConfig.database) {
      toast({
        title: "Not Configured",
        description: "SQL Server is not configured yet. Please ask an administrator.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection: sqlConfig, username: username.trim(), password: password.trim() }),
      });
      const data = await res.json() as {
        success?: boolean;
        user?: { username: string; permetion: string; on_off: string };
        error?: string;
      };

      if (!res.ok || !data.success || !data.user) {
        toast({
          title: "Login Failed",
          description: data.error ?? "Invalid username or account disabled",
          variant: "destructive",
        });
        return;
      }

      const permetion = (data.user.permetion ?? "").toLowerCase();
      const isAdmin = permetion === "admin";
      saveSession({
        username: data.user.username,
        role: isAdmin ? "admin" : "user",
        canSearch: true,
      });
      navigate(isAdmin ? "/admin" : "/search");
    } catch {
      toast({ title: "Error", description: "Could not reach server", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (session) return null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm transform rotate-3">
            <img src={logo} alt="Nazhad inspection System" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Nazhad inspection System</h1>
            <p className="text-muted-foreground font-medium mt-1">Search barcode Taqega</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-5 bg-card p-6 sm:p-8 rounded-xl shadow-sm border">
          <div className="flex flex-col gap-2">
            <Label className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Username</Label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="h-14 text-lg bg-background"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="h-14 text-lg bg-background"
            />
          </div>

          <Button type="submit" size="lg" className="h-14 text-lg font-bold mt-2" disabled={loading}>
            {loading ? "Checking..." : "LOGIN"}
          </Button>
        </form>

      </div>
    </div>
  );
}
