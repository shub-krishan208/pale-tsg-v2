"use client";

import * as React from "react";
import Image from "next/image";
import { Check, Download, Pencil, Wifi, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type QRDisplayProps = {
    onEdit: () => void;
};

export function QRDisplay({ onEdit }: QRDisplayProps) {
    const [secondsLeft, setSecondsLeft] = React.useState(14);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const qrRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const total = 15;
        const id = window.setInterval(() => {
            setSecondsLeft((s) => (s <= 1 ? total : s - 1));
        }, 1000);
        return () => window.clearInterval(id);
    }, []);

    // Handle Escape key to close fullscreen
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen]);

    // Prevent body scroll when fullscreen is open
    React.useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isFullscreen]);

    const handleDownload = async () => {
        if (!qrRef.current) return;

        try {
            // Get the image element
            const img = qrRef.current.querySelector("img");
            if (!img) return;

            // Create a canvas to draw the QR with white background
            const canvas = document.createElement("canvas");
            const size = 512; // High resolution output
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // White background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);

            // Draw the QR image
            const padding = 40;
            const qrSize = size - padding * 2;
            
            // Create a temporary image to draw
            const tempImg = new window.Image();
            tempImg.crossOrigin = "anonymous";
            
            await new Promise<void>((resolve, reject) => {
                tempImg.onload = () => resolve();
                tempImg.onerror = () => reject(new Error("Failed to load image"));
                tempImg.src = img.src;
            });

            ctx.drawImage(tempImg, padding, padding, qrSize, qrSize);

            // Download as PNG
            const link = document.createElement("a");
            link.download = `library-pass-${Date.now()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.error("Failed to download QR:", error);
        }
    };

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
                    <CardContent className="flex flex-col gap-5 px-6 py-6 justify-center items-center">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-white">Entry & Exit Pass</h3>
                            <p className="text-sm text-white/50">Save and scan to enter and exit</p>
                        </div>
                        <div 
                            ref={qrRef} 
                            className="mx-auto w-full max-w-[260px] rounded-2xl bg-white/90 p-6 shadow-sm cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => setIsFullscreen(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && setIsFullscreen(true)}
                            aria-label="View QR code fullscreen"
                        >
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
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:text-white"
                        >
                            <Download className="size-4" />
                            Download QR
                        </button>
                    </CardContent>
                </Card>
            </div>

            {/* Footer status */}
            <div className="mt-4 flex flex-col items-center gap-3">
                <div className="flex flex-col items-center gap-2">
                    <div className="text-xs text-white/55">
                        Auto-refreshing in {secondsLeft}s
                    </div>
                    <Badge className="gap-1.5 border-emerald-300/25 bg-emerald-500/15 text-emerald-50">
                        <Wifi className="size-3.5" aria-hidden />
                        Valid Offline
                    </Badge>
                </div>
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsFullscreen(false)}
                >
                    {/* Close button */}
                    <button
                        type="button"
                        onClick={() => setIsFullscreen(false)}
                        className="absolute top-6 right-6 inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                        aria-label="Close fullscreen"
                    >
                        <X className="size-6" />
                    </button>

                    {/* Hint text */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/50">
                        Tap anywhere or press Escape to close
                    </div>

                    {/* QR Code */}
                    <div 
                        className="w-[80vmin] max-w-[400px] rounded-3xl bg-white p-8 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="relative aspect-square w-full">
                            <Image
                                src="/qr-demo.svg"
                                alt="Entry pass QR code fullscreen"
                                fill
                                sizes="400px"
                                priority
                                className="object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
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
