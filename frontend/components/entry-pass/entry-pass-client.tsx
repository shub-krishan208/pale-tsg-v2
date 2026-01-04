"use client";

import * as React from "react";
import { ToastProvider, UserProfile, AssetDeclarationForm } from "@/components/entry-pass";
import type { EntryPassUser } from "@/components/entry-pass";

const STORAGE_KEY = "library-pass-form";
const DEFAULT_ROLL = "24MA10063";

type SavedFormData = {
    roll: string;
};

export function EntryPassClient() {
    const [roll, setRoll] = React.useState(DEFAULT_ROLL);
    const [isLoaded, setIsLoaded] = React.useState(false);

    // Load saved roll from localStorage on mount
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data: SavedFormData = JSON.parse(saved);
                if (data.roll) {
                    setRoll(data.roll);
                }
            }
        } catch (error) {
            console.error("Failed to load saved roll:", error);
        }
        setIsLoaded(true);
    }, []);

    const handleRollChange = (newRoll: string) => {
        setRoll(newRoll);
    };

    const user: EntryPassUser = {
        roll,
        // name and department can be fetched from backend
    };

    // Don't render until we've loaded from localStorage to prevent hydration mismatch
    if (!isLoaded) {
        return (
            <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                <header className="relative flex items-center justify-center py-3">
                    <h1 className="text-base font-semibold tracking-tight">
                        Library Entry Pass
                    </h1>
                </header>
                <div className="mt-6 flex justify-center">
                    <div className="size-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                {/* Top bar */}
                <header className="relative flex items-center justify-center py-3">
                    <h1 className="text-base font-semibold tracking-tight">
                        Library Entry Pass
                    </h1>
                </header>

                {/* Profile */}
                <UserProfile user={user} onRollChange={handleRollChange} />

                {/* Asset Declaration Form */}
                <AssetDeclarationForm roll={roll} />
            </div>
        </ToastProvider>
    );
}
