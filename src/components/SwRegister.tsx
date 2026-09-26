"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline/PWA é progressivo: falha de registro não quebra o app.
      });
    }
  }, []);
  return null;
}
