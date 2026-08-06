import { useState } from "react";
import { useLocation } from "wouter";
import { getSession, getSqlConfig, trimSqlConfig } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRunBarcodeQuery } from "@workspace/api-client-react";
import { ScannerModal } from "@/components/scanner-modal";
import { Search, ScanLine, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function SearchPage() {
  const [, navigate] = useLocation();
  const session = getSession();
  const { toast } = useToast();

  const [barcode, setBarcode] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const sqlConfig = trimSqlConfig(getSqlConfig());

  const runQuery = useRunBarcodeQuery();

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

  const handleSearch = (e?: React.FormEvent, explicitBarcode?: string) => {
    if (e) e.preventDefault();
    const code = explicitBarcode || barcode;
    if (!code) return;

    if (!sqlConfig.server || !sqlConfig.database) {
      toast({
        title: "Configuration Missing",
        description: "SQL Server is not configured. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }

    runQuery.mutate({
      data: {
        connection: sqlConfig,
        barcode: code.trim()
      }
    });
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

        <div className="relative flex items-center my-2">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-sm font-medium uppercase tracking-wider">or manually enter</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Enter barcode..."
            className="h-10 text-sm bg-background"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={runQuery.isPending}>
            <Search className="w-5 h-5" />
          </Button>
        </form>
      </div>

      <div className="flex-1 flex flex-col gap-4">
        {runQuery.isPending && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {runQuery.isError && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-2">
              <AlertTriangle className="w-10 h-10 text-destructive" />
              <p className="font-medium text-destructive">Lookup failed</p>
              <p className="text-sm text-destructive/80 break-words">
                {runQuery.error instanceof Error
                  ? runQuery.error.message.replace(/^HTTP \d+ [^:]+:\s*/, "")
                  : "Unknown error"}
              </p>
            </CardContent>
          </Card>
        )}

        {runQuery.isSuccess && !runQuery.data.found && (
          <Card className="bg-muted border border-border">
            <CardContent className="p-8 text-center text-muted-foreground font-medium text-lg">
              This does not exist
            </CardContent>
          </Card>
        )}

        {runQuery.isSuccess && runQuery.data.found && runQuery.data.rows.map((row, index) => (
          <Card key={index} className="overflow-hidden border shadow-sm">
            <CardContent className="p-0">
              <div className="bg-secondary text-secondary-foreground p-3 font-bold flex justify-between items-center">
                <span>Result {index + 1}</span>
                <span className="text-primary">{barcode}</span>
              </div>
              <div className="p-4 flex flex-col gap-3">
                {Object.entries(row).map(([key, value]) => (
                  <div key={key} className="flex flex-col border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">{key}</span>
                    <span className="text-base font-medium break-words">{String(value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onDecode={handleDecode}
      />
    </div>
  );
}
