"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Pencil, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type QRDisplayProps = {
    onEdit: () => void;
};

export function QRDisplay({ onEdit }: QRDisplayProps) {
    const [secondsLeft, setSecondsLeft] = React.useState(14);

    React.useEffect(() => {
        const total = 15;
        const id = window.setInterval(() => {
            setSecondsLeft((s) => (s <= 1 ? total : s - 1));
        }, 1000);
        return () => window.clearInterval(id);
    }, []);

    return (
        <>
            <div className="relative mt-10">
                <Badge className="absolute z-10 -top-3 left-1/2 -translate-x-1/2 backdrop-blur-md border-white/15 bg-sky-400/20 text-white px-4 py-1">
                    Asset Declared
                </Badge>
                <button
                    type="button"
                    onClick={onEdit}
                    className="absolute z-10 -top-3 right-0 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white hover:cursor-pointer"
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

            {/* Footer status */}
            <div className="mt-4 flex flex-col items-center gap-2">
                <div className="text-xs text-white/55">
                    Auto-refreshing in {secondsLeft}s
                </div>
                <Badge className="gap-1.5 border-emerald-300/25 bg-emerald-500/15 text-emerald-50">
                    <Wifi className="size-3.5" aria-hidden />
                    Valid Offline
                </Badge>
            </div>
        </>
    );
}

type CompleteButtonProps = {
    disabled: boolean;
    onClick: () => void;
};

export function CompleteButton({ disabled, onClick }: CompleteButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="mt-8 inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-500 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        >
            <Check className="size-5" aria-hidden />
            Completed
        </button>
    );
}
