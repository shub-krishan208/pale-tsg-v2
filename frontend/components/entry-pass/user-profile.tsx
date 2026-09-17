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
    forceEditTrigger?: number;
};

export function UserProfile({ user, onRollChange, onNameChange, forceEditTrigger }: UserProfileProps) {
    const isInitiallyEmpty = !user.roll?.trim() && !user.name?.trim();
    const [isEditing, setIsEditing] = React.useState(isInitiallyEmpty);
    const [rollValue, setRollValue] = React.useState(user.roll || "");
    const [nameValue, setNameValue] = React.useState(user.name || "");
    const [formatError, setFormatError] = React.useState(false);
    const [emptyError, setEmptyError] = React.useState(false);
    const nameInputRef = React.useRef<HTMLInputElement>(null);
    const rollInputRef = React.useRef<HTMLInputElement>(null);

    // Sync state when props change
    React.useEffect(() => {
        setRollValue(user.roll || "");
    }, [user.roll]);

    React.useEffect(() => {
        setNameValue(user.name || "");
    }, [user.name]);

    // If both are empty, default to editing mode
    React.useEffect(() => {
        if (!user.roll?.trim() && !user.name?.trim()) {
            setIsEditing(true);
        }
    }, [user.roll, user.name]);

    // Handle force edit trigger from parent (e.g. when trying to generate pass without details)
    React.useEffect(() => {
        if (forceEditTrigger && forceEditTrigger > 0) {
            setIsEditing(true);
            setEmptyError(true);
            setTimeout(() => {
                if (!nameValue.trim() && nameInputRef.current) {
                    nameInputRef.current.focus();
                } else if (!rollValue.trim() && rollInputRef.current) {
                    rollInputRef.current.focus();
                }
            }, 50);
        }
    }, [forceEditTrigger]);

    // Focus input when entering edit mode
    React.useEffect(() => {
        if (isEditing) {
            if (!nameValue.trim() && nameInputRef.current) {
                nameInputRef.current.focus();
            } else if (rollInputRef.current) {
                rollInputRef.current.focus();
            }
        }
    }, [isEditing]);

    const handleEditClick = () => {
        setIsEditing(true);
        setFormatError(false);
        setEmptyError(false);
    };

    const handleSave = () => {
        const trimmedRoll = rollValue.trim();
        const trimmedName = nameValue.trim();

        // Validate: At least one of roll or name must be non-empty
        if (!trimmedRoll && !trimmedName) {
            setEmptyError(true);
            setFormatError(false);
            return;
        }

        // If roll is provided, validate format
        if (trimmedRoll && !isValidRoll(trimmedRoll)) {
            setFormatError(true);
            setEmptyError(false);
            return;
        }

        setIsEditing(false);
        setFormatError(false);
        setEmptyError(false);

        if (onRollChange && trimmedRoll !== user.roll) {
            onRollChange(trimmedRoll);
        }
        if (onNameChange && trimmedName !== (user.name || "")) {
            onNameChange(trimmedName);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSave();
        } else if (e.key === "Escape") {
            // Revert changes only if at least one was already provided
            if (user.roll || user.name) {
                setRollValue(user.roll || "");
                setNameValue(user.name || "");
                setFormatError(false);
                setEmptyError(false);
                setIsEditing(false);
            }
        }
    };

    const isNameEmpty = !nameValue.trim();
    const isRollEmpty = !rollValue.trim();

    return (
        <section className="mt-3 flex items-start gap-3">
            <Avatar className="size-12 ring-2 ring-white/10 shrink-0 mt-0.5">
                <AvatarFallback className="bg-white/15 text-white">
                    {initials(user.name || user.roll)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                {isEditing ? (
                    <div className="flex-1 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-white/90">
                                Student Details
                            </span>
                            <span className="text-[11px] text-amber-300/80">
                                * At least one required
                            </span>
                        </div>

                        {/* Name Input Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1 text-xs">
                                <label htmlFor="name-input" className="text-white/70 font-medium">
                                    Name
                                </label>
                                {isNameEmpty ? (
                                    <span className="text-[10px] uppercase font-semibold text-amber-300 bg-amber-400/15 px-1.5 py-0.2 rounded border border-amber-400/30">
                                        Empty
                                    </span>
                                ) : (
                                    <span className="text-[10px] uppercase font-semibold text-emerald-300 bg-emerald-400/15 px-1.5 py-0.2 rounded border border-emerald-400/30">
                                        Filled
                                    </span>
                                )}
                            </div>
                            <input
                                id="name-input"
                                ref={nameInputRef}
                                type="text"
                                placeholder="Your Name"
                                value={nameValue}
                                onChange={(e) => {
                                    setNameValue(e.target.value);
                                    if (emptyError) setEmptyError(false);
                                }}
                                onKeyDown={handleKeyDown}
                                maxLength={50}
                                className={`w-full truncate text-sm font-medium leading-5 bg-white/10 border rounded-lg px-2.5 py-1.5 text-white outline-none focus:ring-1 transition-colors ${
                                    emptyError && isNameEmpty
                                        ? "border-red-400 bg-red-500/10 focus:border-red-400 focus:ring-red-400/30"
                                        : isNameEmpty
                                        ? "border-amber-400/30 focus:border-amber-400/50 focus:ring-amber-400/20"
                                        : "border-white/20 focus:border-white/40 focus:ring-white/20"
                                }`}
                            />
                        </div>

                        {/* Roll Number Input Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1 text-xs">
                                <label htmlFor="roll-input" className="text-white/70 font-medium">
                                    Roll Number
                                </label>
                                {isRollEmpty ? (
                                    <span className="text-[10px] uppercase font-semibold text-amber-300 bg-amber-400/15 px-1.5 py-0.2 rounded border border-amber-400/30">
                                        Empty
                                    </span>
                                ) : (
                                    <span className="text-[10px] uppercase font-semibold text-emerald-300 bg-emerald-400/15 px-1.5 py-0.2 rounded border border-emerald-400/30">
                                        Filled
                                    </span>
                                )}
                            </div>
                            <input
                                id="roll-input"
                                ref={rollInputRef}
                                type="text"
                                value={rollValue}
                                placeholder="e.g., 24MA10063"
                                onChange={(e) => {
                                    setRollValue(e.target.value.toUpperCase());
                                    if (emptyError) setEmptyError(false);
                                    if (formatError) setFormatError(false);
                                }}
                                onKeyDown={handleKeyDown}
                                maxLength={10}
                                className={`w-full truncate text-sm font-medium leading-5 bg-white/10 border rounded-lg px-2.5 py-1.5 text-white outline-none focus:ring-1 transition-colors ${
                                    formatError || (emptyError && isRollEmpty)
                                        ? "border-red-400 bg-red-500/10 focus:border-red-400 focus:ring-red-400/30"
                                        : isRollEmpty
                                        ? "border-amber-400/30 focus:border-amber-400/50 focus:ring-amber-400/20"
                                        : "border-white/20 focus:border-white/40 focus:ring-white/20"
                                }`}
                            />
                            {formatError && (
                                <p className="mt-1 text-xs text-red-400 font-medium">
                                    Invalid format (e.g., 24MA100XX)
                                </p>
                            )}
                            {emptyError && (
                                <p className="mt-1 text-xs text-red-400 font-medium">
                                    Please enter either Roll Number or Name (at least one is mandatory)
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2 mt-0.5">
                            <button
                                type="button"
                                className="flex-1 bg-white/20 hover:bg-white/30 text-white rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                                onClick={handleSave}
                            >
                                Save Details
                            </button>
                            {(user.roll || user.name) && (
                                <button
                                    type="button"
                                    className="bg-transparent hover:bg-white/10 text-white/70 hover:text-white rounded-md px-2.5 py-1.5 text-sm transition-colors"
                                    onClick={() => {
                                        setRollValue(user.roll || "");
                                        setNameValue(user.name || "");
                                        setFormatError(false);
                                        setEmptyError(false);
                                        setIsEditing(false);
                                    }}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            {!user.name && !user.roll ? (
                                <div className="rounded-lg border border-red-400/40 bg-red-500/10 p-2 text-xs text-red-200">
                                    <div className="font-semibold text-red-300">Roll No. & Name Missing</div>
                                    <div className="text-[11px] text-red-200/80 mt-0.5">Please tap edit to add at least one.</div>
                                </div>
                            ) : (
                                <>
                                    <div className="truncate text-base font-semibold leading-6 text-white">
                                        {user.name || user.roll}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                        {user.name && user.roll && (
                                            <div className="truncate text-sm font-medium text-white/70">
                                                {user.roll}
                                            </div>
                                        )}
                                        {!user.name && (
                                            <span className="text-[11px] font-medium text-amber-300/90 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                                                Name: Empty
                                            </span>
                                        )}
                                        {!user.roll && (
                                            <span className="text-[11px] font-medium text-amber-300/90 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/30">
                                                Roll No: Empty
                                            </span>
                                        )}
                                    </div>
                                    {user.department ? (
                                        <div className="truncate text-xs text-white/55 mt-0.5">
                                            {user.department}
                                        </div>
                                    ) : null}
                                </>
                            )}
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
