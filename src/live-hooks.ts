import { useEffect, useRef, useState } from 'react';
import { TrainerSession, emptyHost } from './live-session';

export function useTrainerSession() {
  const [snapshot, setSnapshot] = useState(emptyHost);
  const client = useRef<TrainerSession | null>(null);
  const active = useRef(false); active.current = snapshot.active;
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (active.current) { event.preventDefault(); event.returnValue = ''; } };
    const pageHide = (event: PageTransitionEvent) => { if (!event.persisted) client.current?.close(true); };
    const recover = () => { if (document.visibilityState === 'visible') client.current?.resumeConnection(); };
    window.addEventListener('beforeunload', beforeUnload); window.addEventListener('pagehide', pageHide);
    window.addEventListener('pageshow', recover); window.addEventListener('online', recover); window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover); document.addEventListener('resume', recover);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('pagehide', pageHide);
      window.removeEventListener('pageshow', recover); window.removeEventListener('online', recover); window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover); document.removeEventListener('resume', recover);
      client.current?.close(true);
    };
  }, []);
  useEffect(() => {
    if (!snapshot.active || !('wakeLock' in navigator)) return;
    let stopped = false; let lock: WakeLockSentinel | undefined;
    const keepAwake = async () => {
      if (stopped || document.visibilityState !== 'visible' || lock && !lock.released) return;
      try {
        const acquired = await navigator.wakeLock.request('screen');
        if (stopped) await acquired.release(); else lock = acquired;
      } catch { /* Wake Lock is optional; connection recovery does not depend on it. */ }
    };
    void keepAwake(); document.addEventListener('visibilitychange', keepAwake);
    return () => { stopped = true; document.removeEventListener('visibilitychange', keepAwake); void lock?.release().catch(() => {}); };
  }, [snapshot.active]);
  function start() {
    client.current?.close(true); client.current = new TrainerSession(setSnapshot); void client.current.start();
  }
  function close() { client.current?.close(); client.current = null; }
  return { snapshot, client, start, close };
}
