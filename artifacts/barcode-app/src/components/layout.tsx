import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { getSession } from "@/lib/store";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [, navigate] = useLocation();
  const session = getSession();

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handlePointerDown = useCallback(() => {
    timerRef.current = setTimeout(() => {
      navigate("/admin");
    }, 3000);
  }, [navigate]);

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 bg-card text-card-foreground border-b border-border shrink-0">
        <div
          className="flex items-center gap-2 select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="w-8 h-8 rounded-md overflow-hidden bg-primary/10 flex items-center justify-center">
            <img src={logo} alt="logo" className="w-6 h-6 object-cover" />
          </div>
          <h1 className="font-bold text-lg tracking-tight text-foreground">Nazhad inspection System</h1>
        </div>
        {session && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-green-500/30 bg-[rgba(34,197,94,0.08)]">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">User Active</span>
            </div>
            <div className="text-sm font-semibold text-muted-foreground mr-1">
              {session.username}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                localStorage.removeItem("ba_session");
                navigate("/login");
              }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </header>
      <main className="flex-1 overflow-auto flex flex-col">
        {children}
      </main>
    </div>
  );
}
