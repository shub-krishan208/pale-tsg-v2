"use client";

import * as React from "react";
import QRCode from "qrcode";
import { Check, Download, Pencil, Wifi, X, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "./toast-provider";

type QRDisplayProps = {
    onEdit: () => void;
    token?: string;
};

// Demo token for development (will be replaced by backend-provided token)
const DEMO_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbnRyeUlkIjoiZjA3ODE3Y2QtYzJmMi00ZDZmLWIwMDktN2RiMjJmNWYwMjUyIiwicm9sbCI6IjI0TUExMDA2MyIsImFjdGlvbiI6IkVOVEVSSU5HIiwibGFwdG9wIjoiSFAgVklDVFVTIFNBTE1PTkVMTEEgaXg2OTAwMCIsImV4dHJhIjpbeyJuYW1lIjoiY2hhcmdlciIsInR5cGUiOiJnYWRnZXRzIn0seyJuYW1lIjoia2V5cyIsInR5cGUiOiJnYWRnZXRzIn0seyJuYW1lIjoiQXRvbWljIEhhYml0cyIsInR5cGUiOiJib29rcyJ9XSwiaXNzIjoibGlicmFyeS1iYWNrZW5kIiwiYXVkIjoibGlicmFyeS1nYXRlIiwiaWF0IjoxNzY3NTUxMzI3LCJleHAiOjE3Njc2Mzc3Mjd9.cEOH4CzyUC6xnpMcoCjRntBj6nxPgGMclCwqqe0_MnwlYSmUjaHr6yM9a4tC2WNeZ-OC6n_WbnpjJqvfMKVIaT8I3Iz2rNZFpS577OcW1Vgt5PoptbicLEUnFmD7JM3738WmdmDXCX10EiIyKsiEtnKNrDfwdf2f1vVmOJgQvtOq0vB74j5ljkiuNbnWcT_4-sOLojNGRvCf5bDN7LeAVXEB0Mv2-NMHwdGvQ7Wcz1TxAolsjgIkhIJhy5YgO-cRYyWh2CO1Dh-Ae2m3VzoXkbNqk1YJYVfMxCKt2pqw2gbplslAUDcRkeQdR3MHgbm099vvr8c9RTTNYiOSyFBpMQ";

export function QRDisplay({ onEdit, token }: QRDisplayProps) {
    const [secondsLeft, setSecondsLeft] = React.useState(14);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
    const [qrError, setQrError] = React.useState(false);
    const qrRef = React.useRef<HTMLDivElement>(null);
    const { addToast } = useToast();

    // Use provided token or fallback to demo
    const activeToken = token || DEMO_TOKEN;

    // Generate QR code from token
    React.useEffect(() => {
        if (!activeToken) {
            setQrError(true);
            addToast("No token provided for QR generation", { error: true });
            return;
        }

        QRCode.toDataURL(activeToken, {
            width: 512,
            margin: 2,
            color: {
                dark: "#000000",
                light: "#ffffff",
            },
            errorCorrectionLevel: "M",
        })
            .then((url) => {
                setQrDataUrl(url);
                setQrError(false);
            })
            .catch((err) => {
                console.error("Failed to generate QR code:", err);
                setQrError(true);
                addToast("Failed to generate QR code", { error: true });
            });
    }, [activeToken, addToast]);

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
        if (!qrDataUrl) {
            addToast("No QR code to download", { error: true });
            return;
        }

        try {
            // Create a canvas to add padding
            const canvas = document.createElement("canvas");
            const size = 512;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // White background
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, size, size);

            // Draw the QR image
            const img = new window.Image();
            img.src = qrDataUrl;
            
            await new Promise<void>((resolve) => {
                img.onload = () => {
                    const padding = 32;
                    ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
                    resolve();
                };
            });

            // Download as PNG
            const link = document.createElement("a");
            link.download = `library-pass-${Date.now()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (error) {
            console.error("Failed to download QR:", error);
            addToast("Failed to download QR code", { error: true });
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
                            onClick={() => !qrError && setIsFullscreen(true)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && !qrError && setIsFullscreen(true)}
                            aria-label="View QR code fullscreen"
                        >
                            <div className="relative aspect-square w-full flex items-center justify-center">
                                {qrError ? (
                                    <div className="flex flex-col items-center gap-2 text-gray-500">
                                        <AlertTriangle className="size-12" />
                                        <span className="text-sm font-medium">QR Error</span>
                                    </div>
                                ) : qrDataUrl ? (
                                    <img
                                        src={qrDataUrl}
                                        alt="Entry pass QR code"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="size-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                                )}
                            </div>
                        
                        </div>
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={qrError || !qrDataUrl}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/20 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
            {isFullscreen && qrDataUrl && (
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
                        <img
                            src={qrDataUrl}
                            alt="Entry pass QR code fullscreen"
                            className="w-full h-full object-contain"
                        />
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
