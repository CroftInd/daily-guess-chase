"use client";
import { useEffect, useMemo, useState } from "react";

function getUKDateParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(d);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

function nextUKMidnight(): number {
  const now = new Date();
  const p = getUKDateParts(now);
  const base = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + 1, 0, 0, 0));
  // Find the UTC instant that formats as 00:00:00 on tomorrow's UK date.
  for (let minutes = -180; minutes <= 180; minutes++) {
    const candidate = new Date(base.getTime() + minutes * 60000);
    const q = getUKDateParts(candidate);
    if (q.year === String(base.getUTCFullYear()).padStart(4, "0") &&
        q.month === String(base.getUTCMonth() + 1).padStart(2, "0") &&
        q.day === String(base.getUTCDate()).padStart(2, "0") && q.hour === "00") {
      return candidate.getTime();
    }
  }
  return base.getTime();
}

function format(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600).toString().padStart(2, "0");
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Countdown({ compact = false }: { compact?: boolean }) {
  const target = useMemo(() => nextUKMidnight(), []);
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const timer = window.setInterval(() => {
      const left = target - Date.now();
      setRemaining(Math.max(0, left));
      if (left <= 0) window.location.reload();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  return <div className={`countdown${compact ? " countdown-compact" : ""}`} aria-live="polite">
    <span className="countdown-label">NEXT CHALLENGES IN</span>
    <strong>{format(remaining)}</strong>
  </div>;
}
