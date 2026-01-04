"use client";

import * as React from "react";
import { X, Check, Laptop, LibraryBig, Headphones, User } from "lucide-react";
import type { ListItem } from "./types";

type ConfirmationModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    roll: string;
    laptopName: string;
    carryingDevice: boolean;
    personalBooks: ListItem[];
    extraGadgets: ListItem[];
};

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    roll,
    laptopName,
    carryingDevice,
    personalBooks,
    extraGadgets,
}: ConfirmationModalProps) {
    // Prevent body scroll when modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Handle Escape key
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const hasLaptop = carryingDevice && laptopName.trim();
    const filledBooks = personalBooks.filter((b) => b.name.trim());
    const filledGadgets = extraGadgets.filter((g) => g.name.trim());

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200" />
            
            {/* Modal */}
            <div 
                className="relative w-full max-w-sm rounded-2xl bg-linear-to-b from-[#0E3566] to-[#082243] border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                >
                    <X className="size-5" />
                </button>

                {/* Header */}
                <div className="px-6 pt-6 pb-4 text-center">
                    <h2 className="text-lg font-semibold text-white">
                        Confirm Your Declaration
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                        Please verify the details below
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 pb-4 space-y-3">
                    {/* Roll Number */}
                    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                        <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/20">
                            <User className="size-4 text-sky-400" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-xs font-medium text-white/50">Roll Number</div>
                            <div className="truncate text-sm font-medium text-white">{roll}</div>
                        </div>
                    </div>

                    {/* Laptop/Device */}
                    {hasLaptop && (
                        <div className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                            <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                                <Laptop className="size-4 text-amber-400" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-white/50">Device</div>
                                <div className="truncate text-sm text-white">{laptopName}</div>
                            </div>
                        </div>
                    )}

                    {/* Personal Books */}
                    {filledBooks.length > 0 && (
                        <div className="rounded-xl bg-white/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="inline-flex size-7 items-center justify-center rounded-lg bg-blue-500/20">
                                    <LibraryBig className="size-3.5 text-blue-400" />
                                </div>
                                <span className="text-xs font-medium text-white/50">
                                    Personal Books ({filledBooks.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 pl-9">
                                {filledBooks.map((book, i) => (
                                    <li key={i} className="text-sm text-white truncate">
                                        {book.name}
                                        {book.type && book.type !== "book" && (
                                            <span className="ml-1 text-white/40">· {book.type}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Extra Gadgets */}
                    {filledGadgets.length > 0 && (
                        <div className="rounded-xl bg-white/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="inline-flex size-7 items-center justify-center rounded-lg bg-purple-500/20">
                                    <Headphones className="size-3.5 text-purple-400" />
                                </div>
                                <span className="text-xs font-medium text-white/50">
                                    Extra Gadgets ({filledGadgets.length})
                                </span>
                            </div>
                            <ul className="space-y-1.5 pl-9">
                                {filledGadgets.map((gadget, i) => (
                                    <li key={i} className="text-sm text-white truncate">
                                        {gadget.name}
                                        {gadget.type && gadget.type !== "gadget" && (
                                            <span className="ml-1 text-white/40">· {gadget.type}</span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-12 rounded-xl border border-white/15 bg-white/5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
                    >
                        Go Back
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="flex-1 h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                    >
                        <Check className="size-4" />
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
}
