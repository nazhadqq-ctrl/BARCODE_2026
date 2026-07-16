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
    <div className="min-h-[100dvh] flex flex-col">
      <header className="h-16 flex items-center justify-between px-4 bg-secondary text-secondary-foreground shadow-md shrink-0">
        <div
          className="flex items-center gap-2 select-none"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div className="w-8 h-8 rounded overflow-hidden">
            <img src={logo} alt="logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Nazhad inspection System</h1>
        </div>
        {session && (
          <Button
            variant="ghost"
            size="icon"
            className="text-secondary-foreground hover:bg-secondary/80 hover:text-white"
            onClick={() => {
              localStorage.removeItem("ba_session");
              navigate("/login");
            }}
          >
            <LogOut className="w-5 h-5" />
          </Button>
        )}
      </header>
      <main className="flex-1 overflow-auto flex flex-col">
        {children}
      </main>
    </div>
  );
}
