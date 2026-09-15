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
import { ThemeToggle } from "../theme-toggle";

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

// Configurable timeout for how long scan results stay on screen (default: 10 minutes)
const RESET_TIMEOUT_SECONDS = parseInt(
  process.env.NEXT_PUBLIC_SCAN_TIMEOUT_SECONDS || "600",
  10
);
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
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = React.useState<boolean>(false);
  const [showManualInput, setShowManualInput] = React.useState<boolean>(false);
  const [manualToken, setManualToken] = React.useState<string>("");
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  const resetTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("gate_scan_history");
      if (stored) {
        setScanHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load history from local storage", e);
    }
  }, []);

  const appendScanHistory = React.useCallback((result: ScanResult) => {
    setScanHistory((prev) => {
      const MAX_HISTORY = parseInt(process.env.NEXT_PUBLIC_MAX_LOCAL_LOGS || "10000", 10);
      const next = [result, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem("gate_scan_history", JSON.stringify(next));
      } catch (e) {
        console.error("Local storage error:", e);
      }
      return next;
    });
  }, []);

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
        name: data.name,
        laptop: data.laptop,
        extra: data.extra || [],
        message: data.message,
        timestamp: new Date().toLocaleTimeString("en-IN", { hour12: false }),
        rawToken: typeof token === "string" ? token.substring(0, 20) + "..." : "",
      };

      setActiveScan(result);
      setScreenState("RESULT");
      appendScanHistory(result);

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
      appendScanHistory(errorResult);

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
          name: "Abhinav Singh",
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
          name: "Shruti Sharma",
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
          name: "Abhinav Singh",
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
    if (flag === "NORMAL_ENTRY") {
      return "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40";
    }
    if (flag === "NORMAL_EXIT") {
      return "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40";
    }
    if (
      flag === "FORCED_ENTRY" ||
      flag === "DUPLICATE_EXIT" ||
      flag === "EMERGENCY_EXIT"
    ) {
      return "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/40";
    }
    return "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40";
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Professional Header Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs dark:shadow-lg sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-slate-700">
            <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-8 w-auto rounded-md dark:mix-blend-screen" />
            <img src="/frontend/gymkhana-logo.png" alt="TSG Logo" className="h-8 w-auto rounded-md bg-black dark:bg-transparent p-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-base sm:text-lg text-slate-900 dark:text-white">
                CENTRAL LIBRARY
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Gate Monitor
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Entry & Exit Access Verification System
            </p>
          </div>
        </div>

        {/* Center: Live Gate Scanner Status (Common Scanning Mode) */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-medium">Universal Gate Scanner</span>
        </div>

        {/* Right: Clock & Utility Controls */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-2">
            <span className="font-mono text-lg font-bold tracking-wider text-slate-800 dark:text-slate-100">
              {currentTime || "00:00:00"}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {currentDate}
            </span>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border transition-colors ${
              soundEnabled
                ? "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 hover:bg-slate-700"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-800"
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
          <ThemeToggle />

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
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
                ? "bg-blue-600/20 border-blue-500/40 text-blue-700 dark:text-blue-300"
                : "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-700"
            }`}
            title="Recent Scans"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Log</span>
            {scanHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px] text-slate-700 dark:text-slate-200">
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
              <div className="absolute -inset-4 rounded-full bg-cyan-100/50 dark:bg-cyan-500/10 animate-ping duration-1000"></div>
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-linear-to-b from-white dark:from-slate-900 to-slate-50 dark:to-slate-950 border-2 border-cyan-300 dark:border-cyan-500/40 flex flex-col items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                <QrCode className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-600 dark:text-cyan-400 stroke-1" />
                <div className="absolute bottom-2 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-[10px] tracking-widest text-cyan-700 dark:text-cyan-200 font-mono uppercase">
                    ACTIVE
                  </span>
                </div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3">
              GATE SCANNER READY
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-xl font-medium max-w-md mx-auto mb-8">
              Present your QR code pass to the scanner at the library gate.
            </p>

            {/* Status Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Hardware Scanner Listening</span>
              </div>
              <div className="px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
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
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
              Scanned! Processing...
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Verifying cryptographic digital pass with gate registry...
            </p>
          </div>
        )}

        {/* State 3: RESULT DISPLAY */}
        {screenState === "RESULT" && activeScan && (
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-200">
            {activeScan.status === "ALLOWED" ? (() => {
              const isExit = activeScan.mode === "exit";
              const clrBoxBorder = isExit ? "border-amber-300 dark:border-amber-500/40" : "border-emerald-300 dark:border-emerald-500/40";
              const clrBoxGradient = isExit ? "dark:from-amber-950/30" : "dark:from-emerald-950/30";
              const clrBoxShadow = isExit ? "dark:shadow-[0_0_80px_rgba(245,158,11,0.12)]" : "dark:shadow-[0_0_80px_rgba(16,185,129,0.12)]";
              const clrBorderInner = isExit ? "border-amber-200 dark:border-amber-500/20" : "border-emerald-200 dark:border-emerald-500/20";
              const clrIconBg = isExit ? "bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/40" : "bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/40";
              const clrIconText = isExit ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
              const clrTextMain = isExit ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400";
              const clrProgress = isExit ? "bg-amber-500" : "bg-emerald-500";

              return (
              /* ALLOWED DISPLAY */
              <div className={`rounded-2xl border-2 ${clrBoxBorder} bg-white dark:bg-linear-to-b ${clrBoxGradient} dark:via-slate-900/90 dark:to-slate-950 shadow-xl ${clrBoxShadow} p-6 sm:p-8 backdrop-blur-md relative overflow-hidden`}>
                {/* Top Status Header */}
                <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b ${clrBorderInner} gap-4`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl ${clrIconBg} border flex items-center justify-center ${clrIconText} shadow-inner`}>
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                          {isExit ? "EXIT PERMITTED" : "ENTRY PERMITTED"}
                        </span>
                      </div>
                      <p className={`text-xs sm:text-sm ${clrIconText} font-medium`}>
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
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {activeScan.timestamp}
                    </span>
                  </div>
                </div>

                {/* Big Student Profile Section */}
                <div className="py-6 sm:py-8 text-center bg-slate-50/60 dark:bg-slate-950/60 rounded-xl border border-slate-200/50 dark:border-slate-800/50 my-6 shadow-inner">
                  {activeScan.name ? (
                    <>
                      <span className="text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
                        STUDENT PROFILE
                      </span>
                      <div className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white mt-2 mb-1 px-4">
                        {activeScan.name}
                      </div>
                      <div className={`text-lg sm:text-2xl font-bold tracking-wider ${clrTextMain} font-mono`}>
                        {activeScan.roll || "UNKNOWN"}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-semibold tracking-widest text-slate-500 dark:text-slate-400 uppercase">
                        STUDENT ROLL NUMBER
                      </span>
                      <div className={`text-4xl sm:text-6xl font-black tracking-wider ${clrTextMain} font-mono mt-1 px-4`}>
                        {activeScan.roll || "UNKNOWN"}
                      </div>
                    </>
                  )}
                </div>

                {/* Declared Assets Section (Laptop, Books, Gadgets) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Laptop Card */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                      <Laptop className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="text-[10px] font-bold tracking-widest uppercase">
                        Laptop
                      </span>
                    </div>
                    {activeScan.laptop ? (
                      <div className="text-sm font-bold text-slate-900 dark:text-white font-mono break-words leading-tight bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg">
                        {activeScan.laptop}
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                        NONE
                      </div>
                    )}
                  </div>

                  {/* Books Card */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">
                          Books
                        </span>
                      </div>
                      {books.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-black">
                          {books.length}
                        </span>
                      )}
                    </div>
                    {books.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {books.map((book, i) => (
                          <div
                            key={i}
                            className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-md"
                          >
                            • {book.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                        NONE
                      </div>
                    )}
                  </div>

                  {/* Gadgets Card */}
                  <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <Headphones className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-[10px] font-bold tracking-widest uppercase">
                          Gadgets
                        </span>
                      </div>
                      {gadgets.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400 text-[10px] font-black">
                          {gadgets.length}
                        </span>
                      )}
                    </div>
                    {gadgets.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {gadgets.map((gadget, i) => (
                          <div
                            key={i}
                            className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-md"
                          >
                            • {gadget.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                        NONE
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto-Reset Countdown Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${clrIconText}`} />
                      Auto-clearing in {Math.floor(countdown / 60) > 0 ? `${Math.floor(countdown / 60)}m ` : ''}{countdown % 60}s...
                    </span>
                    <button
                      onClick={clearCurrentScan}
                      className="font-semibold underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    >
                      Clear Now
                    </button>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
                    <div
                      className={`h-full ${clrProgress} transition-all duration-1000 ease-linear rounded-full`}
                      style={{
                        width: `${(countdown / RESET_TIMEOUT_SECONDS) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            )})() : (
              /* DENIED DISPLAY */
              <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-500/50 bg-white dark:bg-linear-to-b dark:from-rose-950/40 dark:via-slate-900/95 dark:to-slate-950 shadow-xl dark:shadow-[0_0_80px_rgba(244,63,94,0.18)] p-6 sm:p-8 backdrop-blur-md relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-rose-200 dark:border-rose-500/20 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-rose-100 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shadow-inner">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        ACCESS DENIED
                      </span>
                      <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-medium">
                        Verification Failed — Please see gate personnel
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wide border uppercase bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40">
                      {activeScan.flag || "DENIED"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {activeScan.timestamp}
                    </span>
                  </div>
                </div>

                {/* Show profile if we extracted one despite denial */}
                {(activeScan.name || activeScan.roll) && (
                  <div className="py-4 sm:py-6 text-center bg-rose-50/50 dark:bg-rose-950/30 rounded-xl border border-rose-500/10 mt-6 shadow-inner">
                    {activeScan.name ? (
                      <>
                        <div className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white mt-1 mb-1 px-4">
                          {activeScan.name}
                        </div>
                        <div className="text-base sm:text-xl font-bold tracking-wider text-rose-700 dark:text-rose-400 font-mono">
                          {activeScan.roll || "UNKNOWN"}
                        </div>
                      </>
                    ) : (
                      <div className="text-3xl sm:text-5xl font-black tracking-wider text-rose-700 dark:text-rose-400 font-mono px-4">
                        {activeScan.roll}
                      </div>
                    )}
                  </div>
                )}

                <div className="my-6 p-6 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/30 text-center">
                  <AlertTriangle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto mb-2" />
                  <div className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    {activeScan.message || "Pass verification rejected"}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    If this is an error, verify the QR code was generated
                    recently and student credentials are in good standing.
                  </p>
                </div>

                {/* Auto-Reset Countdown Progress Bar */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      Auto-clearing in {Math.floor(countdown / 60) > 0 ? `${Math.floor(countdown / 60)}m ` : ''}{countdown % 60}s...
                    </span>
                    <button
                      onClick={clearCurrentScan}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-white underline underline-offset-4"
                    >
                      Clear Now
                    </button>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-200 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Manual Token / QR Payload Input
              </span>
              <button
                onClick={() => setShowManualInput(false)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-white"
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
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
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
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Submit Scan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Recent Scans Session Log Drawer */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 p-4 sm:p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Recent Scans Log
              </h3>
            </div>
            <button
              onClick={() => setShowHistory(false)}
              className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-800"
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
              {scanHistory.map((scan) => {
                const isExpanded = expandedIds.has(scan.id);
                return (
                <div
                  key={scan.id}
                  onClick={() => {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(scan.id)) next.delete(scan.id);
                      else next.add(scan.id);
                      return next;
                    });
                  }}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 flex flex-col cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      {scan.status === "ALLOWED" ? (
                        scan.mode === "exit" ? (
                          <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        )
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <div>
                        {scan.name ? (
                          <>
                            <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {scan.name}
                            </div>
                            <div className={`text-[11px] font-mono font-semibold ${
                              scan.status === "DENIED"
                                ? "text-rose-700 dark:text-rose-400"
                                : scan.mode === "exit"
                                ? "text-amber-700 dark:text-amber-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }`}>
                              {scan.roll || "UNKNOWN"}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm font-mono font-bold text-slate-900 dark:text-white leading-tight">
                            {scan.roll || "UNKNOWN"}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
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

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      {scan.laptop && (
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">Laptop:</span> {scan.laptop}
                        </div>
                      )}
                      {scan.extra && scan.extra.length > 0 && (
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">Assets:</span>{" "}
                          {scan.extra.map((e: any) => e.name).join(", ")}
                        </div>
                      )}
                      {scan.message && (
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">Note:</span> {scan.message}
                        </div>
                      )}
                      {!scan.laptop && (!scan.extra || scan.extra.length === 0) && !scan.message && (
                        <div className="text-slate-400 italic">No additional details recorded.</div>
                      )}
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}

      {/* Collaboration Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/90 py-6 px-4 z-20 mt-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>A joint initiative by</span>
            <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-5 w-auto rounded-sm dark:mix-blend-screen opacity-90 dark:opacity-100" />
            <span className="font-semibold px-0.5">x</span>
            <img src="/frontend/gymkhana-logo.png" alt="TSG Logo" className="h-5 w-auto rounded-sm bg-black dark:bg-transparent p-[1px]" />
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            &copy; 2026 Developers' Society
          </p>
        </div>
      </footer>

      {/* Floating Simulation & Controls (Bottom Left) */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3">
        <div className="group relative">
          <button className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl flex items-center justify-center hover:scale-105 transition-transform focus:outline-none">
            <QrCode className="w-5 h-5" />
          </button>
          
          <div className="absolute bottom-full left-0 mb-4 hidden group-hover:flex flex-col gap-1 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl w-48 animate-in fade-in slide-in-from-bottom-2">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-2 px-2">
              Simulation Tools
            </span>
            <button onClick={() => handleSimulate("normal_entry")} className="text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors">
              Normal Entry
            </button>
            <button onClick={() => handleSimulate("assets_entry")} className="text-left px-3 py-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-xs font-medium text-emerald-700 dark:text-emerald-400 transition-colors">
              Entry w/ Assets
            </button>
            <button onClick={() => handleSimulate("normal_exit")} className="text-left px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs font-medium text-amber-700 dark:text-amber-400 transition-colors">
              Exit Scan
            </button>
            <button onClick={() => handleSimulate("denied")} className="text-left px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium text-rose-700 dark:text-rose-400 transition-colors">
              Denied Scan
            </button>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
            <button onClick={() => setShowManualInput(!showManualInput)} className="text-left px-3 py-2 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/30 text-xs font-medium text-cyan-700 dark:text-cyan-400 transition-colors">
              {showManualInput ? "Hide Manual Input" : "Show Manual Input"}
            </button>
          </div>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 font-semibold shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Gate 1 (North Wing)
        </div>
      </div>
    </div>
  );
}
