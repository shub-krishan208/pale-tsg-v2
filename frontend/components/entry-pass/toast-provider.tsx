"use client";

import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import type { Toast, ToastOptions } from "./types";

type ToastContextType = {
    toasts: Toast[];
    addToast: (message: string, options?: ToastOptions) => number;
    removeToast: (id: number) => void;
    updateToast: (id: number, updates: Partial<Toast>) => void;
};

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
    const context = React.useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const addToast = React.useCallback((message: string, options?: ToastOptions) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, loading: options?.loading, error: options?.error }]);
        
        // Auto-remove after duration (default 2500ms, skip if loading)
        if (!options?.loading) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, options?.duration ?? 2500);
        }
        
        return id;
    }, []);

    const removeToast = React.useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const updateToast = React.useCallback((id: number, updates: Partial<Toast>) => {
        setToasts((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
            {children}
            <ToastContainer toasts={toasts} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
    return (
        <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none">
            {toasts.map((toast, index) => (
                <div
                    key={toast.id}
                    className="pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{
                        transform: `scale(${1 - index * 0.05}) translateY(${index * 4}px)`,
                        opacity: 1 - index * 0.15,
                        zIndex: 50 - index,
                    }}
                >
                    <div className={`inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg backdrop-blur ${toast.error ? 'bg-red-50 text-red-900' : 'bg-white/95 text-gray-900'}`}>
                        {toast.loading ? (
                            <Loader2 className="size-4 animate-spin text-gray-600" />
                        ) : toast.error ? (
                            <X className="size-4 text-red-500" />
                        ) : (
                            <Check className="size-4 text-emerald-500" />
                        )}
                        {toast.message}
                    </div>
                </div>
            ))}
        </div>
    );
}
