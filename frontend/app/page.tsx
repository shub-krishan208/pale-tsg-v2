"use client";

import Image from "next/image";
import * as React from "react";
import { Check, Laptop, LibraryBig, Loader2, Headphones, Pencil, Plus, Wifi, X } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type EntryPassUser = {
    roll: string;
    name?: string;
    department?: string;
};

type ListItem = {
    name: string;
    type: string;
};

function initials(name?: string) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}

/**
 * Auto-capitalize first letter of each word when typing.
 * Only applies when new value is longer (typing), not when shorter (backspace).
 */
function autoCapitalize(newValue: string, oldValue: string): string {
    // Allow undo via backspace - don't transform if deleting
    if (newValue.length <= oldValue.length) {
        return newValue;
    }
    // Capitalize first letter of each word
    return newValue.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Home() {
    // NOTE: Backend `User` currently only has `roll`. Keep other fields optional.
    const user: EntryPassUser = React.useMemo(
        () => ({
            roll: "24MA10063",
        }),
        []
    );

    const [carryingDevice, setCarryingDevice] = React.useState(true);
    const [laptopName, setLaptopName] = React.useState("");
    const [personalBooks, setPersonalBooks] = React.useState<ListItem[]>([]);
    const [extraGadgets, setExtraGadgets] = React.useState<ListItem[]>([]);
    const [secondsLeft, setSecondsLeft] = React.useState(14);
    const [qrVisible, setQrVisible] = React.useState(false);
    const [toasts, setToasts] = React.useState<Array<{ id: number; message: string; loading?: boolean; error?: boolean }>>([]);

    // Toast helper function
    const addToast = (message: string, options?: { loading?: boolean; error?: boolean; duration?: number }) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, loading: options?.loading, error: options?.error }]);
        
        // Auto-remove after duration (default 2500ms, skip if loading)
        if (!options?.loading) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, options?.duration ?? 2500);
        }
        
        return id;
    };

    const removeToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const updateToast = (id: number, updates: { message?: string; loading?: boolean; error?: boolean }) => {
        setToasts((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } : t));
    };

    // Check if form has any data
    const isFormEmpty = !laptopName.trim() && 
        personalBooks.every((b) => !b.name.trim()) && 
        extraGadgets.every((g) => !g.name.trim()) &&
        personalBooks.length === 0 && 
        extraGadgets.length === 0;

    const handleComplete = async () => {
        // Validate - at least one field should have data
        if (isFormEmpty) {
            addToast("Please add at least one item", { error: true });
            return;
        }

        // Show loading toast
        const toastId = addToast("Generating pass...", { loading: true });
        
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        // Update to success and remove after delay
        updateToast(toastId, { message: "Pass generated!", loading: false });
        setTimeout(() => removeToast(toastId), 1500);
        
        // Show QR after a brief moment
        setTimeout(() => {
            setQrVisible(true);
        }, 800);
    };

    const handleEdit = () => {
        setQrVisible(false);
        addToast("You can now edit your declaration");
    };

    const addPersonalBook = () => {
        if (personalBooks.length < 5) {
            setPersonalBooks([...personalBooks, { name: "", type: "book" }]);
        }
    };

    const removePersonalBook = (index: number) => {
        setPersonalBooks(personalBooks.filter((_, i) => i !== index));
    };

    const updatePersonalBook = (index: number, field: keyof ListItem, value: string) => {
        const updated = [...personalBooks];
        const oldValue = updated[index][field];
        updated[index] = { ...updated[index], [field]: autoCapitalize(value, oldValue) };
        setPersonalBooks(updated);
    };

    const addExtraGadget = () => {
        if (extraGadgets.length < 10) {
            setExtraGadgets([...extraGadgets, { name: "", type: "gadget" }]);
        }
    };

    const removeExtraGadget = (index: number) => {
        setExtraGadgets(extraGadgets.filter((_, i) => i !== index));
    };

    const updateExtraGadget = (index: number, field: keyof ListItem, value: string) => {
        const updated = [...extraGadgets];
        const oldValue = updated[index][field];
        updated[index] = { ...updated[index], [field]: autoCapitalize(value, oldValue) };
        setExtraGadgets(updated);
    };

    React.useEffect(() => {
        const total = 15;
        const id = window.setInterval(() => {
            setSecondsLeft((s) => (s <= 1 ? total : s - 1));
        }, 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <div className="min-h-dvh bg-linear-to-b from-[#0B2A57] via-[#082243] to-[#061A35] text-white">
            <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                {/* Top bar */}
                <header className="relative flex items-center justify-center py-3">
                    <button
                        type="button"
                        aria-label="Go back"
                        onClick={() => window.history.back()}
                        className="absolute left-0 inline-flex size-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 active:bg-white/15"
                    >
                        {/* <ChevronLeft className="size-6" aria-hidden /> */}
                    </button>
                    <h1 className="text-base font-semibold tracking-tight">
                        Library Entry Pass
                    </h1>
                </header>

                {/* Profile */}
                <section className="mt-3 flex items-center gap-3">
                    <Avatar className="size-12 ring-2 ring-white/10">
                        <AvatarFallback className="bg-white/15 text-white">
                            {initials(user.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <div className="truncate text-lg font-semibold leading-6">
                            {user.name ?? user.roll}
                        </div>
                        {/* <div className="truncate text-sm text-white/70">
                            {user.roll}
                        </div> */}
                        {user.department ? (
                            <div className="truncate text-sm text-white/55">
                                {user.department}
                            </div>
                        ) : null}
                    </div>
                </section>

                {/* Assets */}
                <Card className="mt-5 border-white/10 bg-white/5 py-0 text-white shadow-none backdrop-blur">
                    <CardContent className="px-4 py-4">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10">
                                    <Laptop
                                        className="size-5 text-white/85"
                                        aria-hidden
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium">
                                        Carrying Laptop/Device?
                                    </div>
                                    <div className="truncate text-xs text-white/55">
                                        Declare before entry
                                    </div>
                                </div>
                            </div>
                            <Switch
                                aria-label="Carrying laptop or device"
                                checked={carryingDevice}
                                onCheckedChange={setCarryingDevice}
                                disabled={qrVisible}
                                className="data-[state=checked]:bg-amber-400 data-[state=unchecked]:bg-white/20 **:data-[slot=switch-thumb]:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div className="mt-3 pl-13">
                            <Input
                                value={laptopName}
                                onChange={(e) => setLaptopName(autoCapitalize(e.target.value, laptopName))}
                                placeholder="Laptop/Device name (e.g., HP Victus i5-12450H)"
                                disabled={!carryingDevice || qrVisible}
                                aria-label="Laptop or device name"
                                className="h-10 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                            />
                        </div>

                        {/* Personal Books */}
                        <div className="mt-4 flex items-start gap-3">
                            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                <LibraryBig
                                    className="size-5 text-white/85"
                                    aria-hidden
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium">
                                        Personal Books
                                    </div>
                                    <span className="text-xs text-white/50">
                                        {personalBooks.length}/5
                                    </span>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {personalBooks.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updatePersonalBook(index, "name", e.target.value)}
                                                placeholder="Book title..."
                                                disabled={qrVisible}
                                                className="h-9 flex-1 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                                            />
                                            <Input
                                                value={item.type}
                                                onChange={(e) => updatePersonalBook(index, "type", e.target.value)}
                                                placeholder="Type"
                                                disabled={qrVisible}
                                                className="h-9 w-20 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                                            />
                                            {!qrVisible && (
                                                <button
                                                    type="button"
                                                    onClick={() => removePersonalBook(index)}
                                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                                                    aria-label="Remove book"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {personalBooks.length < 5 && !qrVisible && (
                                        <button
                                            type="button"
                                            onClick={addPersonalBook}
                                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 text-sm text-white/60 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white/80"
                                        >
                                            <Plus className="size-4" />
                                            Add Book
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Extra Gadgets */}
                        <div className="mt-4 flex items-start gap-3">
                            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                <Headphones
                                    className="size-5 text-white/85"
                                    aria-hidden
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium">
                                        Extra Gadgets
                                    </div>
                                    <span className="text-xs text-white/50">
                                        {extraGadgets.length}/10
                                    </span>
                                </div>
                                <div className="mt-2 space-y-2">
                                    {extraGadgets.map((item, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updateExtraGadget(index, "name", e.target.value)}
                                                placeholder="Gadget name..."
                                                disabled={qrVisible}
                                                className="h-9 flex-1 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                                            />
                                            <Input
                                                value={item.type}
                                                onChange={(e) => updateExtraGadget(index, "type", e.target.value)}
                                                placeholder="Type"
                                                disabled={qrVisible}
                                                className="h-9 w-20 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
                                            />
                                            {!qrVisible && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeExtraGadget(index)}
                                                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                                                    aria-label="Remove gadget"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {extraGadgets.length < 10 && !qrVisible && (
                                        <button
                                            type="button"
                                            onClick={addExtraGadget}
                                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 text-sm text-white/60 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white/80"
                                        >
                                            <Plus className="size-4" />
                                            Add Gadget
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Completed Button or QR */}
                {!qrVisible ? (
                    <button
                        type="button"
                        onClick={handleComplete}
                        disabled={toasts.some((t) => t.loading)}
                        className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        <Check className="size-5" aria-hidden />
                        Completed
                    </button>
                ) : (
                    <div className="relative mt-10">
                        <Badge className="absolute z-10 -top-3 left-1/2 -translate-x-1/2 backdrop-blur-md border-white/15 bg-sky-400/20 text-white px-4 py-1">
                            Asset Declared
                        </Badge>
                        <button
                            type="button"
                            onClick={handleEdit}
                            className="absolute z-10 -top-3 right-0 inline-flex items-center gap-1 rounded-full  px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white hover:cursor-pointer"
                        >
                            <Pencil className="size-3" />
                            Edit
                        </button>
                        <Card className="border-white/10 bg-white/5 py-0 shadow-none backdrop-blur">
                            <CardContent className="px-6 py-6">
                                <div className="mx-auto w-full max-w-[260px] rounded-2xl bg-white/90 p-6 shadow-sm">
                                    <div className="relative aspect-square w-full">
                                        <Image
                                            src="/qr-demo.svg"
                                            alt="Entry pass QR code"
                                            fill
                                            sizes="260px"
                                            priority
                                            className="object-contain"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Footer status */}
                {qrVisible && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                        <div className="text-xs text-white/55">
                            Auto-refreshing in {secondsLeft}s
                        </div>
                        <Badge className="gap-1.5 border-emerald-300/25 bg-emerald-500/15 text-emerald-50">
                            <Wifi className="size-3.5" aria-hidden />
                            Valid Offline
                        </Badge>
                    </div>
                )}
            </div>

            {/* Stacking Toasts */}
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
        </div>
    );
}
