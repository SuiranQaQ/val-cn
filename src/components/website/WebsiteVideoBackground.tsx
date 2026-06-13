"use client";

import { useEffect, useState } from "react";

const VIDEO_SRC = "/videos/home-bg.mp4";

export function WebsiteVideoBackground() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(start, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {ready ? (
        <video
          className="val-website-video"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <div className="val-website-video-fallback" />
      )}
      <div className="val-website-video-overlay" />
    </div>
  );
}
