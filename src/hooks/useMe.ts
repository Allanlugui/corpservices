"use client";

import { useEffect, useState } from "react";

export interface Me {
  email: string;
  role: string;
  displayName: string | null;
  overlay?: { module: string; action: string; allowed: boolean }[];
  avatarUrl?: string;
  mustReset?: boolean;
}

/** Perfil da sessão (papel para RBAC da navegação). Null = carregando ou sem sessão. */
export function useMe(): { me: Me | null; loading: boolean; refresh: () => void } {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/me")
      .then(async (res) => {
        if (res.ok) {
          const json = await res.json();
          setMe(json.data as Me);
        } else {
          setMe(null);
        }
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [tick]);

  return { me, loading, refresh: () => setTick((t) => t + 1) };
}
