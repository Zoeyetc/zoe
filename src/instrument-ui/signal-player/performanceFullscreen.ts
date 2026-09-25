export const FULLSCREEN_CURSOR_IDLE_MS = 2500;

export type PerformanceFullscreenState = Readonly<{
  active: boolean;
  supported: boolean;
  error: 'unavailable' | 'request-failed' | null;
}>;

/** Presentation state only. The browser remains the source of fullscreen truth. */
export function createPerformanceFullscreenController(
  root: HTMLElement,
  document: Document,
  onChange: (state: PerformanceFullscreenState) => void,
) {
  const supported = typeof root.requestFullscreen === 'function' && typeof document.exitFullscreen === 'function';
  let disposed = false;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let error: PerformanceFullscreenState['error'] = null;

  const clearIdle = () => {
    if (idleTimer !== null) clearTimeout(idleTimer);
    idleTimer = null;
    root.dataset.cursorIdle = 'false';
  };
  const armIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      idleTimer = null;
      if (!disposed && document.fullscreenElement === root) root.dataset.cursorIdle = 'true';
    }, FULLSCREEN_CURSOR_IDLE_MS);
  };
  const read = (): PerformanceFullscreenState => ({
    active: document.fullscreenElement === root,
    supported,
    error,
  });
  const synchronize = () => {
    if (disposed) return;
    error = null;
    if (document.fullscreenElement === root) armIdle();
    else clearIdle();
    onChange(read());
  };
  const onPointerMove = () => {
    if (document.fullscreenElement === root) armIdle();
  };

  document.addEventListener('fullscreenchange', synchronize);
  root.addEventListener('pointermove', onPointerMove);
  synchronize();

  return {
    read,
    async toggle() {
      if (disposed) return;
      if (!supported) {
        error = 'unavailable';
        onChange(read());
        return;
      }
      try {
        if (document.fullscreenElement === root) await document.exitFullscreen();
        else await root.requestFullscreen();
      } catch {
        if (disposed) return;
        error = 'request-failed';
        onChange(read());
      }
    },
    dispose() {
      disposed = true;
      clearIdle();
      document.removeEventListener('fullscreenchange', synchronize);
      root.removeEventListener('pointermove', onPointerMove);
    },
  };
}
