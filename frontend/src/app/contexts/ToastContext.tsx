import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────── */

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface QueuedToast {
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

/* ── Context ───────────────────────────────────────────── */

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/* ── Provider ──────────────────────────────────────────── */

const TOAST_DURATION = 3500;
const EXIT_DURATION = 400; // ms for the exit animation to finish

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [active, setActive] = useState<Toast | null>(null);
  const queue = useRef<QueuedToast[]>([]);
  const isAnimating = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Process the next toast in the queue
  const processQueue = useCallback(() => {
    if (isAnimating.current) return;
    const next = queue.current.shift();
    if (!next) return;

    isAnimating.current = true;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setActive({ id, ...next });

    // Auto-dismiss after duration
    timerRef.current = setTimeout(() => {
      setActive(null);
      // Wait for exit animation, then process next
      setTimeout(() => {
        isAnimating.current = false;
        processQueue();
      }, EXIT_DURATION);
    }, TOAST_DURATION);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    queue.current.push({ message, type });
    processQueue();
  }, [processQueue]);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setActive(null);
    setTimeout(() => {
      isAnimating.current = false;
      processQueue();
    }, EXIT_DURATION);
  }, [processQueue]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast portal — renders at fixed position at top of viewport */}
      <div className="fixed top-0 left-0 right-0 z-[9999] flex justify-center pointer-events-none">
        <AnimatePresence mode="wait">
          {active && (
            <ToastItem key={active.id} toast={active} onDismiss={dismiss} />
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

/* ── Toast Item ────────────────────────────────────────── */

const typeConfig = {
  success: {
    icon: CheckCircle,
    bg: 'bg-green-500/10',
    border: 'border-green-500/25',
    iconColor: 'text-green-400',
    barColor: 'bg-green-400',
  },
  error: {
    icon: XCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    iconColor: 'text-red-400',
    barColor: 'bg-red-400',
  },
  info: {
    icon: Info,
    bg: 'bg-[#eb7524]/10',
    border: 'border-[#eb7524]/25',
    iconColor: 'text-[#eb7524]',
    barColor: 'bg-[#eb7524]',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = typeConfig[toast.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ y: -80, opacity: 0, scale: 0.95 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -80, opacity: 0, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 28,
        mass: 0.8,
      }}
      className="pointer-events-auto mt-4 mx-4 max-w-md w-full"
    >
      <div
        className={`${config.bg} ${config.border} border backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden`}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0`} />
          <p
            className="text-white flex-1 min-w-0"
            style={{
              fontSize: '14px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {toast.message}
          </p>
          <button
            onClick={onDismiss}
            className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0 cursor-pointer p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Progress bar */}
        <motion.div
          className={`h-[2px] ${config.barColor}`}
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: TOAST_DURATION / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  );
}

/* ── Hook ──────────────────────────────────────────────── */

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
