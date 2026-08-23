import { useState, useEffect } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SiteLock({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  // Read from sessionStorage on mount to persist unlock across reloads in the same tab
  useEffect(() => {
    if (sessionStorage.getItem("site_unlocked") === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "Admin-CN-Nazhad" && password === "PCN-Nazhad!@#123") {
      setIsUnlocked(true);
      setError(false);
      sessionStorage.setItem("site_unlocked", "true");
    } else {
      setError(true);
      setPassword("");
    }
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 opacity-90" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/40 via-black/0 to-black/0" />
      
      <Card className="relative z-10 w-full max-w-md border-zinc-800 bg-zinc-950/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 pb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 shadow-inner">
            <Lock className="h-8 w-8 text-zinc-400" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-semibold tracking-tight text-zinc-100">Restricted Access</CardTitle>
            <CardDescription className="text-zinc-400">
              This environment is protected. Please authenticate to proceed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUnlock} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-zinc-300">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="off"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
                placeholder="Enter username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-zinc-900/50 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-700"
                placeholder="Enter password"
              />
            </div>
            
            {error && (
              <div className="flex items-center space-x-2 text-red-500 text-sm mt-2 p-2.5 bg-red-500/10 rounded-md border border-red-500/20">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                <p>Invalid credentials. Access denied.</p>
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full bg-zinc-100 text-zinc-900 hover:bg-zinc-200 transition-all font-medium mt-6"
            >
              Unlock Environment
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
