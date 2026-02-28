export const RATE_LIMIT_MARKER = "Zbyt wiele zapytań";

let listeners = new Set<() => void>();
let resumeListeners = new Set<() => void>();

export function onRateLimitHit(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function onRateLimitResume(cb: () => void) {
  resumeListeners.add(cb);
  return () => { resumeListeners.delete(cb); };
}

function emit() {
  listeners.forEach((cb) => cb());
}

export function emitResume() {
  resumeListeners.forEach((cb) => cb());
}

/** Call in any catch block — fires the global modal only for 429 errors. */
export function checkRateLimit(err: unknown): void {
  if (err instanceof Error && err.message.includes(RATE_LIMIT_MARKER)) {
    emit();
  }
}
