/** In-process subscribers for session changes (SSE). Not cross-instance. */

type Listener = () => void;

const g = globalThis as unknown as { __nicola_session_listeners?: Set<Listener> };

function listeners(): Set<Listener> {
  if (!g.__nicola_session_listeners) {
    g.__nicola_session_listeners = new Set();
  }
  return g.__nicola_session_listeners;
}

export function notifySessionChanged(): void {
  for (const fn of listeners()) {
    try {
      fn();
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeSessionChanged(handler: Listener): () => void {
  listeners().add(handler);
  return () => {
    listeners().delete(handler);
  };
}
