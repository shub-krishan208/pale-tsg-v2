"use client";

import * as React from "react";
import { ToastProvider, UserProfile, AssetDeclarationForm } from "@/components/entry-pass";
import type { EntryPassUser } from "@/components/entry-pass";
const STORAGE_KEY = "library-pass-form";

type SavedFormData = {
    roll: string;
    name?: string;
};

export function EntryPassClient() {
    const [roll, setRoll] = React.useState("");
    const [name, setName] = React.useState("");
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [forceEditTrigger, setForceEditTrigger] = React.useState(0);

    // Load saved roll and name from localStorage on mount
    React.useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data: SavedFormData = JSON.parse(saved);
                if (data.roll) {
                    setRoll(data.roll);
                }
                if (data.name) {
                    setName(data.name);
                }
            }
        } catch (error) {
            console.error("Failed to load saved roll:", error);
        }
        setIsLoaded(true);
    }, []);

    const handleRollChange = (newRoll: string) => {
        setRoll(newRoll);
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const data: SavedFormData = saved ? JSON.parse(saved) : { roll: "" };
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, roll: newRoll }));
        } catch (error) {
            console.error("Failed to save roll:", error);
        }
    };

    const handleNameChange = (newName: string) => {
        setName(newName);
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const data: SavedFormData = saved ? JSON.parse(saved) : { roll: "" };
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, name: newName }));
        } catch (error) {
            console.error("Failed to save name:", error);
        }
    };

    const user: EntryPassUser = {
        roll,
        name: name || undefined,
        // department can be fetched from backend
    };

    // Don't render until we've loaded from localStorage to prevent hydration mismatch
    if (!isLoaded) {
        return (
            <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                <header className="relative flex items-center justify-center py-3">
                    <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-8 w-auto absolute left-0 rounded-sm mix-blend-screen" />
                    <h1 className="text-base font-semibold tracking-tight mx-auto">
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
            <div className="mx-auto w-full max-w-sm px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] flex flex-col min-h-dvh">
                {/* Top bar */}
                <header className="relative flex items-center py-3">
                    <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-8 w-auto absolute left-0 rounded-sm mix-blend-screen" />
                    <h1 className="text-base font-semibold tracking-tight mx-auto">
                        Library Entry Pass
                    </h1>
                </header>

                {/* Profile */}
                <UserProfile
                    user={user}
                    onRollChange={handleRollChange}
                    onNameChange={handleNameChange}
                    forceEditTrigger={forceEditTrigger}
                />

                {/* Asset Declaration Form */}
                <div className="flex-1">
                    <AssetDeclarationForm
                        roll={roll}
                        name={name}
                        onRequireProfile={() => setForceEditTrigger((prev) => prev + 1)}
                    />
                </div>

                {/* Footer */}
                <footer className="mt-10 mb-4 border-t border-white/10 pt-6">
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-xs text-white/60">
                            <span>A joint initiative by</span>
                            <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-5 w-auto rounded-sm mix-blend-screen opacity-90" />
                            <span className="font-semibold text-white/50 px-0.5">x</span>
                            <img src="/frontend/gymkhana-logo.png" alt="TSG Logo" className="h-5 w-auto opacity-90" />
                        </div>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">
                            &copy; 2026 Developers' Society
                        </p>
                    </div>
                </footer>
            </div>
        </ToastProvider>
    );
}
