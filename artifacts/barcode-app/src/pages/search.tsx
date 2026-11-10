import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { getSession } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScannerModal } from "@/components/scanner-modal";
import { Search, ScanLine, AlertTriangle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SearchPage() {
  const [, navigate] = useLocation();
  const session = getSession();
  const { toast } = useToast();

  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<{ found: boolean; rows: Record<string, unknown>[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dbStatus, setDbStatus] = useState<"unknown" | "checking" | "connected" | "offline">("unknown");
  const didMount = useRef(false);

  const checkDb = useCallback(async () => {
    setDbStatus("checking");
    try {
      const res = await fetch("/api/healthz", { credentials: "include" });
      if (res.ok) {
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

  if (!session) {
    navigate("/login");
    return null;
  }

  if (!session.canSearch) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-muted/30">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold text-foreground text-center mb-2">Access Denied</h2>
        <p className="text-muted-foreground text-center">You do not have permission to search.</p>
        <Button className="mt-8 w-full max-w-xs" size="lg" onClick={() => navigate("/")}>
          Return to Login
        </Button>
      </div>
    );
  }

  const handleSearch = async (e?: React.FormEvent, explicitBarcode?: string) => {
    if (e) e.preventDefault();
    const code = explicitBarcode || barcode;
    if (!code.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setQueryResult(null);

    try {
      const res = await fetch("/api/sql/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ barcode: code.trim() }),
      });

      if (res.status === 401) {
        toast({
          title: "Session Expired",
          description: "Please log in again.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Lookup failed");
        return;
      }

      setQueryResult(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  const handleDecode = (text: string) => {
    setBarcode(text);
    handleSearch(undefined, text);
  };

  return (
    <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 gap-6">
      <div className="flex flex-col gap-4">
        <Button
          onClick={() => setScannerOpen(true)}
          className="w-full h-auto py-6 text-base font-medium rounded-lg shadow-sm border border-border flex flex-col gap-2"
        >
          <ScanLine className="w-6 h-6" />
          SCAN BARCODE
        </Button>

        <div className="flex items-center justify-center gap-2 text-sm mt-[-4px]">
          {dbStatus === "checking" ? (
            <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
          ) : (
            <div
              className={`w-3 h-3 rounded-full ${
                dbStatus === "connected"
                  ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
              }`}
            />
          )}
          <span className="font-medium text-muted-foreground">
            {dbStatus === "checking"
              ? "Checking connection..."
              : dbStatus === "connected"
              ? "Server connected"
              : "Server problem or not configured"}
          </span>
        </div>

        <div className="relative flex items-center my-2">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium uppercase tracking-wider">
            or manually enter
          </span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Enter barcode..."
            className="h-10 text-sm bg-background"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={loading}>
            <Search className="w-5 h-5" />
          </Button>
        </form>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {loading && (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {errorMsg && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
              <AlertTriangle className="w-10 h-10 text-destructive" />
              <p className="font-medium text-destructive">Lookup failed</p>
              <p className="text-sm text-destructive/80 break-words">{errorMsg}</p>
            </CardContent>
          </Card>
        )}

        {queryResult && !queryResult.found && (
          <Card className="bg-muted border border-border">
            <CardContent className="p-8 text-center text-muted-foreground font-medium text-lg">
              This does not exist
            </CardContent>
          </Card>
        )}

        {queryResult &&
          queryResult.found &&
          queryResult.rows.map((row: any, index: number) => (
            <Card key={index} className="overflow-hidden border shadow-sm">
              <CardContent className="p-0">
                <div className="bg-secondary text-secondary-foreground p-3 font-bold flex justify-between items-center">
                  <span>Result {index + 1}</span>
                  <span className="text-primary">{barcode}</span>
                </div>
                <div className="p-4 flex flex-col gap-3">
                  {Object.entries(row).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex flex-col border-b border-border/50 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                        {key}
                      </span>
                      <span className="text-base font-medium break-words">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <ScannerModal open={scannerOpen} onOpenChange={setScannerOpen} onDecode={handleDecode} />
    </div>
  );
}
