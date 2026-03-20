"use client";

import { useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";

const SPLASH_KEY = "filcraft_splash_v1";

// All 3D assets loaded by AetheriaWorld — fetched now to prime the browser cache
// so Three.js finds them already cached when the world initializes.
const MODEL_URLS = [
  "/models/RobotExpressive.glb",
  "/models/Castle.glb",
  "/models/filecoin_model.glb",
  "/models/furnace.glb",
];

function preloadWorldAssets() {
  MODEL_URLS.forEach((url) => {
    fetch(url).catch(() => {});
  });
}

export function SplashGate({ children }: { children: React.ReactNode }) {
  // "checking" → brief dark screen while we read sessionStorage (avoids SSR mismatch)
  // "splash"   → show the loading animation
  // "done"     → render the world
  const [state, setState] = useState<"checking" | "splash" | "done">("checking");

  useEffect(() => {
    // Kick off model downloads immediately — animation gives us ~8 s to cache them
    preloadWorldAssets();

    const alreadyShown = (() => {
      try {
        const ts = Number(sessionStorage.getItem(SPLASH_KEY) ?? 0);
        return ts > 0 && Date.now() - ts < 120_000;
      } catch {
        return false;
      }
    })();

    setState(alreadyShown ? "done" : "splash");
  }, []);

  // Dark overlay below navbar — keeps navbar visible for fast LCP
  const NAVBAR_H = 56;
  if (state === "checking") {
    return <div style={{ position: "fixed", top: NAVBAR_H, left: 0, right: 0, bottom: 0, background: "#0a0804", zIndex: 9999 }} />;
  }

  if (state === "splash") {
    return (
      <LoadingScreen
        onEnter={() => {
          try {
            sessionStorage.setItem(SPLASH_KEY, String(Date.now()));
          } catch {}
          setState("done");
        }}
      />
    );
  }

  return <>{children}</>;
}
