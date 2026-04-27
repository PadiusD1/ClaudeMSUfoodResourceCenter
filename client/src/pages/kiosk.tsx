import React, { useEffect, useRef, useCallback, useState } from "react";
import PublicRequestPage from "./public-request";

export default function KioskPage() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setResetKey((k) => k + 1);
    }, 120000); // 2 minutes
  }, []);

  useEffect(() => {
    const events = ["click", "touchstart", "keypress", "mousemove"] as const;
    const handler = () => resetTimer();
    events.forEach((e) => window.addEventListener(e, handler));
    resetTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [resetTimer]);

  return (
    <div className="min-h-screen bg-background" key={resetKey}>
      <PublicRequestPage variant="kiosk" />
    </div>
  );
}
