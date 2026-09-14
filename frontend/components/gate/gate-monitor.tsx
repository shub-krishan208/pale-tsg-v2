"use client";

import * as React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Laptop,
  BookOpen,
  Headphones,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  ShieldCheck,
  History,
  QrCode,
  ArrowRightLeft,
} from "lucide-react";
import { ScanResult, ScannerScreenState } from "./types";

// Helper for Web Audio API chimes
function playChime(type: "allow" | "deny") {
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "allow") {
      // Pleasant two-tone chime (F#5 -> A5)
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now); // E5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.45);
    } else {
      // Low dual warning buzzer
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(180, now + 0.15);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

const RESET_TIMEOUT_SECONDS = 6;

export function GateMonitor() {
  const [screenState, setScreenState] =
    React.useState<ScannerScreenState>("IDLE");
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [currentDate, setCurrentDate] = React.useState<string>("");

  const [activeScan, setActiveScan] = React.useState<ScanResult | null>(null);
  const [countdown, setCountdown] = React.useState<number>(RESET_TIMEOUT_SECONDS);
  const [scanHistory, setScanHistory] = React.useState<ScanResult[]>([]);
  const [showHistory, setShowHistory] = React.useState<boolean>(false);
  const [showManualInput, setShowManualInput] = React.useState<boolean>(false);
  const [manualToken, setManualToken] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  const resetTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Live Digital Clock
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hardware barcode/QR scanner listener (keyboard-wedge mode)
  React.useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an explicit text input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      // Hardware scanners type very rapidly (< 60ms between characters)
      if (now - lastKeyTime > 300) {
        buffer = "";
      }
      lastKeyTime = now;

      if (e.key === "Enter") {
        if (buffer.trim().length > 5) {
          e.preventDefault();
          processScanInput(buffer.trim());
          buffer = "";
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [soundEnabled]);

  // Handle countdown & auto reset to IDLE
  const startResetTimer = React.useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setCountdown(RESET_TIMEOUT_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current)
            clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    resetTimerRef.current = setTimeout(() => {
      setScreenState("IDLE");
      setActiveScan(null);
    }, RESET_TIMEOUT_SECONDS * 1000);
  }, []);

  const clearCurrentScan = () => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setScreenState("IDLE");
    setActiveScan(null);
  };

  // Process a scanned token or payload string
  const processScanInput = async (rawInput: string) => {
    if (!rawInput || isProcessing) return;

    setIsProcessing(true);
    setScreenState("PROCESSING");

    try {
      let token = rawInput;
      let extraPayload: any = {};

      // Check if input is JSON from QR generator: { token, mode }
      try {
        const parsed = JSON.parse(rawInput);
        if (parsed.token) {
          token = parsed.token;
        }
        if (parsed.isSimulation) {
          extraPayload = parsed;
        }
      } catch {
        // raw token
      }

      // Call API route with scan data (Common scanning mode)
      const res = await fetch("/frontend/api/gate/process/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          raw: rawInput,
          ...extraPayload,
        }),
      });

      const data = await res.json();

      const result: ScanResult = {
        id: Math.random().toString(36).substring(2, 9),
        status: data.status === "ALLOWED" ? "ALLOWED" : "DENIED",
        flag: data.flag || (data.status === "ALLOWED" ? "NORMAL_ENTRY" : "DENIED"),
        mode: (data.mode || "entry") as "entry" | "exit",
        roll: data.roll,
        laptop: data.laptop,
        extra: data.extra || [],
        message: data.message,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        rawToken: typeof token === "string" ? token.substring(0, 20) + "..." : "",
      };

      setActiveScan(result);
      setScreenState("RESULT");
      setScanHistory((prev) => [result, ...prev.slice(0, 29)]);

      if (soundEnabled) {
        playChime(result.status === "ALLOWED" ? "allow" : "deny");
      }

      startResetTimer();
    } catch (err: any) {
      const errorResult: ScanResult = {
        id: Math.random().toString(36).substring(2, 9),
        status: "DENIED",
        flag: "SCAN_ERROR",
        mode: "entry",
        message: err.message || "Failed to process scan token",
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
      };
      setActiveScan(errorResult);
      setScreenState("RESULT");
      setScanHistory((prev) => [errorResult, ...prev.slice(0, 29)]);

      if (soundEnabled) playChime("deny");
      startResetTimer();
    } finally {
      setIsProcessing(false);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Quick simulation helpers
  const handleSimulate = (
    scenario: "normal_entry" | "assets_entry" | "normal_exit" | "denied"
  ) => {
    if (scenario === "normal_entry") {
      processScanInput(
        JSON.stringify({
          token: "demo_token_normal_entry",
          mode: "entry",
          roll: "21CS10042",
          laptop: null,
          extra: [],
          isSimulation: true,
        })
      );
    } else if (scenario === "assets_entry") {
      processScanInput(
        JSON.stringify({
          token: "demo_token_assets_entry",
          mode: "entry",
          roll: "22EE30018",
          laptop: "MacBook Pro M3 - SN: C02X892J",
          extra: [
            { type: "books", name: "Introduction to Algorithms (CLRS)" },
            { type: "books", name: "Operating System Concepts" },
            { type: "gadgets", name: "Sony WH-1000XM5 Headphones" },
          ],
          isSimulation: true,
        })
      );
    } else if (scenario === "normal_exit") {
      processScanInput(
        JSON.stringify({
          token: "demo_token_normal_exit",
          mode: "exit",
          roll: "21CS10042",
          laptop: "Dell Latitude 5420",
          extra: [{ type: "books", name: "Data Communications & Networking" }],
          isSimulation: true,
        })
      );
    } else {
      processScanInput(
        JSON.stringify({
          token: "demo_token_denied",
          scenario: "denied",
          isSimulation: true,
        })
      );
    }
  };

  // Visual styling helpers
  const getFlagBadgeColor = (flag: string) => {
    if (flag === "NORMAL_ENTRY" || flag === "NORMAL_EXIT") {
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
    if (
      flag === "FORCED_ENTRY" ||
      flag === "DUPLICATE_EXIT" ||
      flag === "EMERGENCY_EXIT"
    ) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
    return "bg-rose-500/20 text-rose-300 border-rose-500/40";
  };

  // Extract books and gadgets from activeScan.extra
  const books =
    activeScan?.extra?.filter(
      (item) => item.type === "books" || item.type === "book"
    ) || [];
  const gadgets =
    activeScan?.extra?.filter(
      (item) => item.type === "gadgets" || item.type === "gadget"
    ) || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Professional Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-base sm:text-lg text-white">
                CENTRAL LIBRARY
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Gate Monitor
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Entry & Exit Access Verification System
            </p>
          </div>
        </div>

        {/* Center: Live Gate Scanner Status (Common Scanning Mode) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 text-xs text-slate-300 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium">Universal Gate Scanner</span>
        </div>

        {/* Right: Clock & Utility Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="font-mono text-lg font-bold tracking-wider text-slate-100">
              {currentTime || "00:00:00"}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              {currentDate}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? "bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700"
                : "bg-slate-900 border-slate-800 text-slate-500 hover:bg-slate-800"
            }`}
            title={soundEnabled ? "Sound enabled" : "Sound muted"}
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Monitor"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>

          {/* Recent History Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg border flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              showHistory
                ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Recent Scans"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Log</span>
            {scanHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-200">
                {scanHistory.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 max-w-5xl w-full mx-auto relative">
        {/* State 1: IDLE / WAITING */}
        {screenState === "IDLE" && (
          <div className="w-full max-w-3xl text-center flex flex-col items-center py-10 sm:py-16 animate-in fade-in zoom-in-95 duration-300">
            {/* Pulsing Radar Scanner Indicator */}
            <div className="relative mb-8 flex items-center justify-center">
              <div className="absolute -inset-4 rounded-full bg-cyan-500/10 animate-ping duration-1000"></div>
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-linear-to-b from-slate-900 to-slate-950 border-2 border-cyan-500/40 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                <QrCode className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-400 stroke-1" />
                <div className="absolute bottom-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] tracking-widest text-cyan-200 font-mono uppercase">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-3">
              GATE SCANNER READY
            </h1>
            <p className="text-slate-400 text-base sm:text-xl font-medium max-w-md mx-auto mb-8">
              Present your QR code pass to the scanner at the library gate.
            </p>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Hardware Scanner Listening</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-blue-950/40 border border-blue-800/40 text-xs font-medium text-blue-300 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Entry & Exit Verification Active</span>
              </div>
            </div>
          </div>
        )}

        {/* State 2: PROCESSING */}
        {screenState === "PROCESSING" && (
          <div className="w-full max-w-2xl text-center py-16 flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin mb-6"></div>
            <h2 className="text-3xl font-black tracking-tight text-white mb-2">
              Scanned! Processing...
            </h2>
            <p className="text-slate-400 text-sm">
              Verifying cryptographic digital pass with gate registry...
            </p>
          </div>
        )}

        {/* State 3: RESULT DISPLAY */}
        {screenState === "RESULT" && activeScan && (
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-200">
            {activeScan.status === "ALLOWED" ? (
              /* ALLOWED DISPLAY */
              <div className="rounded-2xl border-2 border-emerald-500/40 bg-linear-to-b from-emerald-950/30 via-slate-900/90 to-slate-950 shadow-[0_0_80px_rgba(16,185,129,0.12)] p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
                {/* Top Status Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-emerald-500/20 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                          {activeScan.mode === "exit"
                            ? "EXIT PERMITTED"
                            : "ENTRY PERMITTED"}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-400 font-medium">
                        Student Pass Verified & Logged
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide border uppercase ${getFlagBadgeColor(
                        activeScan.flag
                      )}`}
                    >
                      {activeScan.flag}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeScan.timestamp}
                    </span>
                  </div>
                </div>

                {/* Big Student Roll Number Section */}
                <div className="py-6 sm:py-8 text-center bg-slate-950/60 rounded-xl border border-emerald-500/10 my-6 shadow-inner">
                  <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                    STUDENT ROLL NUMBER
                  </span>
                  <div className="text-4xl sm:text-6xl font-black tracking-wider text-emerald-300 font-mono mt-1">
                    {activeScan.roll || "UNKNOWN"}
                  </div>
                </div>

                {/* Declared Assets Section (Laptop, Books, Gadgets) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Laptop Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-400 mb-2">
                      <Laptop className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        LAPTOP
                      </span>
                    </div>
                    <div>
                      {activeScan.laptop ? (
                        <div className="font-mono text-sm font-semibold text-white bg-slate-800/80 px-2.5 py-1.5 rounded border border-slate-700 break-words">
                          {activeScan.laptop}
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-slate-500 italic">
                          NONE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Books Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          BOOKS
                        </span>
                      </div>
                      {books.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          {books.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {books.length > 0 ? (
                        books.map((b, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-200 bg-slate-800/60 px-2 py-1 rounded truncate border border-slate-700/50"
                            title={b.name}
                          >
                            • {b.name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm font-medium text-slate-500 italic">
                          NONE
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Gadgets Card */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-slate-400 mb-2">
                      <div className="flex items-center gap-2">
                        <Headphones className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">
                          GADGETS
                        </span>
                      </div>
                      {gadgets.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                          {gadgets.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {gadgets.length > 0 ? (
                        gadgets.map((g, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-200 bg-slate-800/60 px-2 py-1 rounded truncate border border-slate-700/50"
                            title={g.name}
                          >
                            • {g.name}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm font-medium text-slate-500 italic">
                          NONE
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto-Reset Countdown Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Auto-clearing in {countdown}s...
                    </span>
                    <button
                      onClick={clearCurrentScan}
                      className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4"
                    >
                      Clear Now
                    </button>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                      style={{
                        width: `${(countdown / RESET_TIMEOUT_SECONDS) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              /* DENIED DISPLAY */
              <div className="rounded-2xl border-2 border-rose-500/50 bg-linear-to-b from-rose-950/40 via-slate-900/95 to-slate-950 shadow-[0_0_80px_rgba(244,63,94,0.18)] p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-rose-500/20 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                        ACCESS DENIED
                      </span>
                      <p className="text-xs sm:text-sm text-rose-400 font-medium">
                        Verification Failed — Please see gate personnel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wide border uppercase bg-rose-500/20 text-rose-300 border-rose-500/40">
                      {activeScan.flag || "DENIED"}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {activeScan.timestamp}
                    </span>
                  </div>
                </div>

                <div className="my-8 p-6 rounded-xl bg-rose-950/20 border border-rose-500/30 text-center">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-white mb-1">
                    {activeScan.message || "Pass verification rejected"}
                  </div>
                  <p className="text-xs text-slate-400">
                    If this is an error, verify the QR code was generated
                    recently and student credentials are in good standing.
                  </p>
                </div>

                {/* Auto-Reset Countdown Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-400" />
                      Auto-clearing in {countdown}s...
                    </span>
                    <button
                      onClick={clearCurrentScan}
                      className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-4"
                    >
                      Clear Now
                    </button>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                      style={{
                        width: `${(countdown / RESET_TIMEOUT_SECONDS) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Collapsible Manual Input Bar (for testing / pasting tokens) */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 mb-4">
        {showManualInput && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                Manual Token / QR Payload Input
              </span>
              <button
                onClick={() => setShowManualInput(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste JWT token or JSON payload here (e.g. { token: '...' })..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualToken.trim()) {
                    processScanInput(manualToken.trim());
                    setManualToken("");
                    setShowManualInput(false);
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  if (manualToken.trim()) {
                    processScanInput(manualToken.trim());
                    setManualToken("");
                    setShowManualInput(false);
                  }
                }}
                disabled={!manualToken.trim() || isProcessing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Submit Scan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Scans Session Log Drawer */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-40 p-4 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-base">
                Recent Scans Log
              </h3>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            >
              ✕
            </button>
          </div>

          {scanHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No scans recorded in this session yet.
            </div>
          ) : (
            <div className="space-y-2.5">
              {scanHistory.map((scan) => (
                <div
                  key={scan.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {scan.status === "ALLOWED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-mono font-bold text-white">
                        {scan.roll || "UNKNOWN"}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="uppercase font-semibold text-[10px]">
                          {scan.mode}
                        </span>
                        <span>•</span>
                        <span>{scan.flag}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {scan.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bottom Footer with Test Simulation and Quick Controls */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-3 px-4 sm:px-6 z-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Gate 1 (North Library Wing)</span>
            <span>•</span>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
            >
              {showManualInput ? "Hide Manual Input" : "Manual Input"}
            </button>
          </div>

          {/* Quick Scenario Test Simulators for Staff / Devs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mr-1">
              Simulation:
            </span>
            <button
              onClick={() => handleSimulate("normal_entry")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium transition-colors"
            >
              Normal Entry
            </button>
            <button
              onClick={() => handleSimulate("assets_entry")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-emerald-300 font-medium transition-colors"
            >
              Entry w/ Assets
            </button>
            <button
              onClick={() => handleSimulate("normal_exit")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-300 font-medium transition-colors"
            >
              Exit Scan
            </button>
            <button
              onClick={() => handleSimulate("denied")}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-rose-300 font-medium transition-colors"
            >
              Denied Scan
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
