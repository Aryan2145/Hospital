import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Clock } from "lucide-react";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 5 * 60 * 1000;

export function IdleTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(async () => {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
    const data = await res?.json().catch(() => ({})) ?? {};
    window.location.href = data.redirectTo || "/";
  }, []);

  const resetTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setShowWarning(false);

    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(Math.floor(WARNING_BEFORE_MS / 1000));
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);

    idleTimerRef.current = setTimeout(logout, IDLE_TIMEOUT_MS);
  }, [logout]);

  const stayActive = useCallback(() => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    let lastReset = Date.now();

    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 60000) {
        lastReset = now;
        if (!showWarning) resetTimers();
      }
    };

    events.forEach(e => window.addEventListener(e, throttledReset, { passive: true }));
    resetTimers();

    return () => {
      events.forEach(e => window.removeEventListener(e, throttledReset));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [resetTimers, showWarning]);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-idle-warning">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            Session Expiring Soon
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-3">
            For the security of patient data, your session will expire due to inactivity.
          </p>
          <div className="flex items-center gap-2 text-lg font-semibold text-destructive" data-testid="text-idle-countdown">
            <Clock className="w-5 h-5" />
            {minutes}:{seconds.toString().padStart(2, "0")} remaining
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={logout} data-testid="button-logout-now">
            Sign Out Now
          </Button>
          <Button onClick={stayActive} data-testid="button-stay-active">
            Stay Active
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
