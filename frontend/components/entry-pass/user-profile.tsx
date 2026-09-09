"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "./utils";
import type { EntryPassUser } from "./types";

// Roll format: 2 digits + 2 letters + 4-6 digits (e.g., 24MA10063)
const ROLL_REGEX = /^\d{2}[A-Z]{2}\d{4,6}$/;

function isValidRoll(roll: string): boolean {
    return ROLL_REGEX.test(roll);
}

type UserProfileProps = {
    user: EntryPassUser;
    onRollChange?: (roll: string) => void;
    onNameChange?: (name: string) => void;
};

export function UserProfile({ user, onRollChange, onNameChange }: UserProfileProps) {
    const [isEditing, setIsEditing] = React.useState(false);
    const [rollValue, setRollValue] = React.useState(user.roll);
    const [nameValue, setNameValue] = React.useState(user.name || "");
    const [hasError, setHasError] = React.useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const isValid = isValidRoll(rollValue);

    // Focus input when entering edit mode
    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleEditClick = () => {
        setIsEditing(true);
        setHasError(false);
    };

    const handleSave = () => {
        if (isValid) {
            setIsEditing(false);
            setHasError(false);
            if (onRollChange && rollValue !== user.roll) {
                onRollChange(rollValue);
            }
            if (onNameChange && nameValue !== (user.name || "")) {
                onNameChange(nameValue);
            }
        } else {
            setHasError(true);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            setRollValue(user.roll); // Revert changes
            setNameValue(user.name || "");
            setHasError(false);
            setIsEditing(false);
        }
    };

    return (
        <section className="mt-3 flex items-center gap-3">
            <Avatar className="size-12 ring-2 ring-white/10">
                <AvatarFallback className="bg-white/15 text-white">
                    {initials(user.name || user.roll)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <div>
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Your Name"
                                value={nameValue}
                                onChange={(e) => setNameValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                maxLength={50}
                                className={`w-full truncate text-lg font-semibold leading-6 bg-white/10 border rounded-lg px-2 py-0.5 text-white outline-none focus:ring-1 border-white/20 focus:border-white/40 focus:ring-white/20`}
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                value={rollValue}
                                placeholder="Roll Number"
                                onChange={(e) => {
                                    setRollValue(e.target.value.toUpperCase());
                                    setHasError(false);
                                }}
                                onKeyDown={handleKeyDown}
                                maxLength={10}
                                className={`w-full truncate text-sm font-medium leading-5 bg-white/10 border rounded-lg px-2 py-0.5 text-white outline-none focus:ring-1 ${
                                    hasError 
                                        ? 'border-red-400 focus:border-red-400 focus:ring-red-400/30' 
                                        : 'border-white/20 focus:border-white/40 focus:ring-white/20'
                                }`}
                            />
                            {hasError && (
                                <p className="mt-1 text-xs text-red-400">
                                    Invalid format (e.g., 24MA100XX)
                                </p>
                            )}
                        </div>
                        <button 
                            className="bg-white/20 hover:bg-white/30 text-white rounded-md px-3 py-1 text-sm font-medium transition-colors"
                            onClick={handleSave}
                        >
                            Save
                        </button>
                    </div>
                ) : (
                    <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="truncate text-lg font-semibold leading-6">
                                {user.name || user.roll}
                            </div>
                            {user.name ? (
                                <div className="truncate text-sm font-medium text-white/70">
                                    {user.roll}
                                </div>
                            ) : null}
                            {user.department ? (
                                <div className="truncate text-xs text-white/55 mt-0.5">
                                    {user.department}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={handleEditClick}
                            className="shrink-0 inline-flex size-6 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                            aria-label="Edit profile"
                        >
                            <Pencil className="size-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
