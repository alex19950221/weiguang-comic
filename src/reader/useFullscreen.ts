import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createFullscreenPort } from '@/native/comicReader';
import { FullscreenSession, type FullscreenPort } from './fullscreen';

export function useFullscreen(override?: FullscreenPort) {
  const port = useMemo(() => override ?? createFullscreenPort(), [override]);
  const session = useMemo(() => new FullscreenSession(port), [port]);
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(false);
  const mounted = useRef(true),
    locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const update = () => {
      void Promise.resolve(port.read())
        .then((value) => {
          if (mounted.current) setActive(value);
        })
        .catch(() => {
          if (mounted.current) setError(true);
        });
    };
    const unsubscribe = port.subscribe(update);
    void session
      .initialize()
      .then(update)
      .catch(() => {
        if (mounted.current) setError(true);
      })
      .finally(() => {
        if (mounted.current) setBusy(false);
      });
    return () => {
      mounted.current = false;
      unsubscribe();
      void session.release().catch(() => undefined);
    };
  }, [port, session]);
  async function toggle() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(false);
    try {
      await session.toggle();
      const value = await port.read();
      if (mounted.current) setActive(value);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function release() {
    locked.current = true;
    if (mounted.current) setBusy(true);
    try {
      await session.release();
    } catch {
      if (mounted.current) setError(true);
    }
  }
  return { active, busy, error, toggle, release };
}
