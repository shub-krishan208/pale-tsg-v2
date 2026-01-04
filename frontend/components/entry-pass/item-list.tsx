"use client";

import * as React from "react";
import { Headphones, LibraryBig, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { safeAutoCapitalize } from "./utils";
import type { ListItem } from "./types";

type ItemListProps = {
    title: string;
    icon: "books" | "gadgets";
    items: ListItem[];
    maxItems: number;
    disabled: boolean;
    onAdd: () => void;
    onRemove: (index: number) => void;
    onUpdate: (index: number, field: keyof ListItem, value: string) => void;
    placeholder: string;
    addLabel: string;
};

export function ItemList({
    title,
    icon,
    items,
    maxItems,
    disabled,
    onAdd,
    onRemove,
    onUpdate,
    placeholder,
    addLabel,
}: ItemListProps) {
    const IconComponent = icon === "books" ? LibraryBig : Headphones;

    return (
        <div className="mt-4 flex items-start gap-3">
            <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <IconComponent className="size-5 text-white/85" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{title}</div>
                    <span className="text-xs text-white/50">
                        {items.length}/{maxItems}
                    </span>
                </div>
                <div className="mt-2 space-y-2">
                    {items.map((item, index) => (
                        <ItemRow
                            key={index}
                            item={item}
                            index={index}
                            disabled={disabled}
                            placeholder={placeholder}
                            onUpdate={onUpdate}
                            onRemove={onRemove}
                        />
                    ))}
                    {items.length < maxItems && !disabled && (
                        <button
                            type="button"
                            onClick={onAdd}
                            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 text-sm text-white/60 transition-colors hover:border-white/30 hover:bg-white/5 hover:text-white/80"
                        >
                            <Plus className="size-4" />
                            {addLabel}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

type ItemRowProps = {
    item: ListItem;
    index: number;
    disabled: boolean;
    placeholder: string;
    onUpdate: (index: number, field: keyof ListItem, value: string) => void;
    onRemove: (index: number) => void;
};

function ItemRow({ item, index, disabled, placeholder, onUpdate, onRemove }: ItemRowProps) {
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, "name", safeAutoCapitalize(e.target.value, item.name));
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(index, "type", safeAutoCapitalize(e.target.value, item.type));
    };

    return (
        <div className="flex items-center gap-2">
            <Input
                value={item.name}
                onChange={handleNameChange}
                placeholder={placeholder}
                disabled={disabled}
                className="h-9 flex-1 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
            />
            <Input
                value={item.type}
                onChange={handleTypeChange}
                placeholder="Type"
                disabled={disabled}
                className="h-9 w-20 border-white/12 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-white/25 disabled:opacity-60"
            />
            {!disabled && (
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                    aria-label="Remove item"
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    );
}
