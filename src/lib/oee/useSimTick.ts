import { useEffect, useState } from "react";
import { getNowMs } from "./shiftClock";

/**
 * Re-renders the caller whenever simulated time enters a new sampling window (default 30 s of
 * simulated time), also on time scale changes, pause and jumps. Returns the window bucket.
 * Polls the central clock every 500 ms; renders only when the bucket changes (no remount).
 */
export function useSimWindowBucket(windowSec = 30): number {
  const [bucket, setBucket] = useState(() => Math.floor(getNowMs() / (windowSec * 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      const b = Math.floor(getNowMs() / (windowSec * 1000));
      setBucket((cur) => (cur === b ? cur : b));
    }, 500);
    return () => clearInterval(id);
  }, [windowSec]);
  return bucket;
}
