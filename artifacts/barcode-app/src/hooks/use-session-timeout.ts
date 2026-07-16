import { useEffect, useRef, useCallback, useState } from "react";
import { getSession, saveSession, getSessionTimeoutSettings } from "@/lib/store";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
const WARNING_SECONDS = 60;

export function useSessionTimeout(onLogout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopAll = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timerRef.current = null;
    warningTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const logout = useCallback(() => {
    stopAll();
    setShowWarning(false);
    saveSession(null);
    onLogout();
  }, [stopAll, onLogout]);

  const startCountdown = useCallback(() => {
    setSecondsLeft(WARNING_SECONDS);
    setShowWarning(true);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(logout, WARNING_SECONDS * 1000);
  }, [logout]);

  const resetTimer = useCallback(() => {
    const session = getSession();
    if (!session) return;

    const { timeoutMinutes } = getSessionTimeoutSettings();
    if (timeoutMinutes === 0) return;

    stopAll();
    setShowWarning(false);

    const warningAt = (timeoutMinutes * 60 - WARNING_SECONDS) * 1000;
    if (warningAt <= 0) {
      timerRef.current = setTimeout(logout, timeoutMinutes * 60 * 1000);
    } else {
      warningTimerRef.current = setTimeout(startCountdown, warningAt);
    }
  }, [stopAll, logout, startCountdown]);

  const stayLoggedIn = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    const { timeoutMinutes } = getSessionTimeoutSettings();
    if (timeoutMinutes === 0) return;

    resetTimer();

    const handler = () => {
      if (!showWarning) resetTimer();
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      stopAll();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
    };
  }, []);

  return { showWarning, secondsLeft, stayLoggedIn, logout };
}
