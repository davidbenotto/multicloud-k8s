"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (options: Omit<Toast, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const duration = options.duration ?? 5000;

    setToasts((prev) => [...prev, { ...options, id }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Toast Container
function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// Individual Toast
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const icons: Record<ToastVariant, ReactNode> = {
    default: null,
    success: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
    error: <AlertCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
  };

  const borderColors: Record<ToastVariant, string> = {
    default: "border-border",
    success: "border-emerald-500/30",
    error: "border-red-500/30",
    warning: "border-amber-500/30",
    info: "border-blue-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: "spring", duration: 0.3 }}
      className={cn(
        "pointer-events-auto flex items-start gap-3 w-80 p-4 rounded-lg",
        "bg-card border shadow-lg",
        borderColors[toast.variant],
      )}
    >
      {icons[toast.variant] && (
        <div className="flex-shrink-0">{icons[toast.variant]}</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-muted-foreground mt-1">
            {toast.description}
          </p>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

// Convenience methods
export const toastHelpers = {
  success: (title: string, description?: string) => ({
    title,
    description,
    variant: "success" as const,
  }),
  error: (title: string, description?: string) => ({
    title,
    description,
    variant: "error" as const,
  }),
  warning: (title: string, description?: string) => ({
    title,
    description,
    variant: "warning" as const,
  }),
  info: (title: string, description?: string) => ({
    title,
    description,
    variant: "info" as const,
  }),
};
