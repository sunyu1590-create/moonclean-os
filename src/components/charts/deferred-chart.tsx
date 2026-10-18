"use client";

import { useEffect, useRef, useState } from "react";

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
        children
      ) : (
        <div
          aria-hidden="true"
          className="h-full w-full rounded-xl bg-[#f4f7fa]"
        />
      )}
    </div>
  );
}
