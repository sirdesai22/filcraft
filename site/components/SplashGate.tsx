"use client";

import { useState, useEffect } from "react";
import { LoadingScreen } from "@/components/LoadingScreen";

const SPLASH_KEY = "filcraft_splash_v1";

// All 3D assets loaded by AetheriaWorld — fetched now to prime the browser cache
// so Three.js finds them already cached when the world initializes.
const MODEL_URLS = [
  "/models/RobotExpressive.glb",
  "/models/CastleModel.glb",
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
    // Kick off model downloads immediately — animation gives us ~9 s to cache them
    preloadWorldAssets();

    const alreadyShown = (() => {
      try {
        const ts = Number(sessionStorage.getItem(SPLASH_KEY) ?? 0);
        return ts > 0 && Date.now() - ts < 30_000;
      } catch {
        return false;
      }
    })();

    setState(alreadyShown ? "done" : "splash");
  }, []);

  // Tiny dark flash during hydration — invisible against our #0a0804 background
  if (state === "checking") {
    return <div style={{ position: "fixed", inset: 0, background: "#0a0804", zIndex: 9999 }} />;
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
