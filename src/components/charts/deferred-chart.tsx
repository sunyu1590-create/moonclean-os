"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/** Keep a fixed chart footprint while delaying its JS until it is near the viewport. */
export function DeferredChart({
  children,
  className = "chart-wrap",
  label = "图表",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      const timer = setTimeout(() => setReady(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px 0px", threshold: 0.01 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={host} className={className} aria-label={label}>
      {ready ? (
        <div className="mc-chart-reveal h-full w-full">{children}</div>
      ) : (
        <div aria-hidden="true" className="grid h-full grid-rows-[auto_1fr_auto] gap-3 rounded-xl border border-[#edf2f7] bg-white/60 p-3">
          <div className="flex justify-between"><Skeleton className="h-3 w-24"/><Skeleton className="h-3 w-14"/></div>
          <div className="flex items-end gap-2 border-b border-dashed border-[#e9eff5] pb-2">
            {[42, 66, 50, 78, 55, 88, 62, 72, 48].map((height, index) => <Skeleton key={index} className="min-w-1 flex-1 rounded-t-md" style={{ height: `${height}%` }}/>) }
          </div>
          <div className="flex justify-between"><Skeleton className="h-2.5 w-10"/><Skeleton className="h-2.5 w-10"/><Skeleton className="h-2.5 w-10"/><Skeleton className="h-2.5 w-10"/></div>
        </div>
      )}
    </div>
  );
}
