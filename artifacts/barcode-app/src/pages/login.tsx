import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import logo from "@/assets/logo.png";
import { getSession, saveSession } from "@/lib/store";
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

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        user?: { username: string; role: "admin" | "user"; canSearch: boolean };
        error?: string;
      };

      if (!res.ok || !data.success || !data.user) {
        toast({
          title: "Login Failed",
          description: data.error ?? "Invalid username or password",
          variant: "destructive",
        });
        return;
      }

      saveSession(data.user);
      navigate(data.user.role === "admin" ? "/admin" : "/search");
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
          <div className="w-12 h-12 rounded-md overflow-hidden shadow-sm">
            <img src={logo} alt="Nazhad inspection System" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Nazhad inspection System</h1>
            <p className="text-muted-foreground font-medium mt-1">Search barcode Taqega</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-card p-6 rounded-lg shadow-sm border border-border flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-sm uppercase tracking-wider font-bold text-muted-foreground">Username</Label>
            <Input
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              className="h-10 text-sm bg-background"
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
              className="h-10 text-sm bg-background"
            />
          </div>

          <Button type="submit" className="h-10 font-medium mt-2" disabled={loading}>
            {loading ? "Checking..." : "LOGIN"}
          </Button>
        </form>
      </div>
    </div>
  );
}
