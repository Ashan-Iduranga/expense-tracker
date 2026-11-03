import { createContext, use, useCallback, useRef, useState, type ReactNode } from 'react';

export type ToastMessage = {
  id: number;
  text: string;
  icon: 'check' | 'trash';
  /** When set, the toast shows an Undo button that calls this. */
  undo?: () => void;
};

type ToastContextValue = {
  toast: ToastMessage | null;
  showToast: (text: string, undo?: () => void) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/** Long enough to read and reach Undo; after that the action is final. */
const VisibleMs = 5000;

/** One toast at a time, shown above the nav: confirmations, and deletes with Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(1);

  const hideToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback(
    (text: string, undo?: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ id: nextId.current++, text, icon: undo ? 'trash' : 'check', undo });
      timer.current = setTimeout(hideToast, VisibleMs);
    },
    [hideToast]
  );

  return <ToastContext value={{ toast, showToast, hideToast }}>{children}</ToastContext>;
}

export function useToast() {
  const value = use(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}
