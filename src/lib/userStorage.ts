import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getUserTimes, setUserTimes, addUserTime, patchUserTime, deleteUserTime } from "@/lib/userTimes.functions";
import type { TimeEntry } from "@/lib/cartola-types";

const USER_KEY = "scoutfc_user_id";
const TIMES_KEY = "scoutfc_times_v1";

const ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;
export const validateId = (id: string) => ID_RE.test(id);

// Global subscriber-based store so all components share the same userId
const listeners = new Set<() => void>();
let currentUserId: string | null = null;
let bootstrapped = false;

function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  currentUserId = localStorage.getItem(USER_KEY);
  bootstrapped = true;
  // Cross-tab sync
  window.addEventListener("storage", (e) => {
    if (e.key === USER_KEY) {
      currentUserId = e.newValue;
      listeners.forEach(l => l());
    }
  });
}

function notify() { listeners.forEach(l => l()); }

export function useUserSession() {
  const [, force] = useState(0);
  const [loaded, setLoaded] = useState(bootstrapped);

  useEffect(() => {
    bootstrap();
    setLoaded(true);
    const fn = () => force(x => x + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const login = useCallback((id: string) => {
    const normalized = id.toLowerCase();
    if (!validateId(normalized)) return false;
    localStorage.setItem(USER_KEY, normalized);
    currentUserId = normalized;
    notify();
    return true;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    currentUserId = null;
    notify();
  }, []);

  return { userId: currentUserId, loaded, login, logout };
}

export function useTimesStorage(userId: string | null) {
  const [times, setTimesState] = useState<TimeEntry[]>([]);
  const [syncing, setSyncing] = useState(false);
  const migratedFor = useRef<string | null>(null);

  const get = useServerFn(getUserTimes);
  const setSrv = useServerFn(setUserTimes);
  const addSrv = useServerFn(addUserTime);
  const patchSrv = useServerFn(patchUserTime);
  const delSrv = useServerFn(deleteUserTime);

  // Initial load
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (userId) {
      setSyncing(true);
      get({ data: { user_id: userId } })
        .then(async (r) => {
          const localRaw = localStorage.getItem(TIMES_KEY);
          const local: TimeEntry[] = localRaw ? JSON.parse(localRaw) : [];
          // Migration: if server empty and local has data, push and clear local
          if ((!r.exists || r.times.length === 0) && local.length > 0 && migratedFor.current !== userId) {
            migratedFor.current = userId;
            await setSrv({ data: { user_id: userId, times: local } });
            setTimesState(local);
            localStorage.removeItem(TIMES_KEY);
          } else {
            setTimesState(r.times as TimeEntry[]);
          }
        })
        .catch(() => setTimesState([]))
        .finally(() => setSyncing(false));
    } else {
      const raw = localStorage.getItem(TIMES_KEY);
      setTimesState(raw ? JSON.parse(raw) : []);
    }
  }, [userId]);

  const persist = useCallback(async (next: TimeEntry[]) => {
    setTimesState(next);
    if (userId) {
      await setSrv({ data: { user_id: userId, times: next } });
    } else if (typeof window !== "undefined") {
      localStorage.setItem(TIMES_KEY, JSON.stringify(next));
    }
  }, [userId]);

  const addTime = useCallback(async (t: TimeEntry) => {
    if (userId) {
      const r = await addSrv({ data: { user_id: userId, time: t } });
      setTimesState(r.times as TimeEntry[]);
    } else {
      const next = [...times, t];
      await persist(next);
    }
  }, [userId, times, persist]);

  const updateTime = useCallback(async (id: number, patch: Partial<TimeEntry>) => {
    if (userId) {
      const allowed: any = {};
      if ("indice_confianca" in patch) allowed.indice_confianca = patch.indice_confianca;
      if ("oculto" in patch) allowed.oculto = patch.oculto;
      if ("nome" in patch) allowed.nome = patch.nome;
      const r = await patchSrv({ data: { user_id: userId, time_id: id, patch: allowed } });
      setTimesState(r.times as TimeEntry[]);
    } else {
      const next = times.map(t => t.id === id ? { ...t, ...patch } : t);
      await persist(next);
    }
  }, [userId, times, persist]);

  const removeTime = useCallback(async (id: number) => {
    if (userId) {
      const r = await delSrv({ data: { user_id: userId, time_id: id } });
      setTimesState(r.times as TimeEntry[]);
    } else {
      await persist(times.filter(t => t.id !== id));
    }
  }, [userId, times, persist]);

  return { times, syncing, addTime, updateTime, removeTime, setTimes: persist };
}
