import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastState {
  text: string;
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (text: string, undo?: () => void) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const SHOW_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number>(undefined);

  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((text: string, undo?: () => void) => {
    window.clearTimeout(timer.current);
    setToast({ text, action: undo && { label: '되돌리기', run: undo } });
    timer.current = window.setTimeout(hide, SHOW_MS);
  }, [hide]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && (
        <div className="toast" role="status" aria-live="polite" onMouseDown={(e) => e.preventDefault()}>
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" className="toast-action" onClick={() => { toast.action!.run(); hide(); }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}
