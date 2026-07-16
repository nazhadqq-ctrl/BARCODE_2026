import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";

interface SessionTimeoutModalProps {
  open: boolean;
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

export function SessionTimeoutModal({ open, secondsLeft, onStay, onLogout }: SessionTimeoutModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => onStay()}>
      <DialogContent
        className="max-w-sm text-center"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Session Expiring</DialogTitle>
        <DialogDescription className="sr-only">Your session is about to expire due to inactivity.</DialogDescription>

        <div className="flex flex-col items-center gap-5 py-2">
          <div className="relative flex items-center justify-center">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                className="text-muted/30" />
              <circle
                cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="4"
                className="text-primary transition-all duration-1000"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - secondsLeft / 60)}`}
                strokeLinecap="round"
              />
            </svg>
            <Clock className="w-7 h-7 text-primary absolute" />
          </div>

          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-foreground">Still there?</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              You'll be logged out in{" "}
              <span className="font-bold text-foreground tabular-nums">{secondsLeft}s</span>{" "}
              due to inactivity.
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={onLogout}
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
            <Button
              className="flex-1"
              onClick={onStay}
            >
              Stay logged in
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
