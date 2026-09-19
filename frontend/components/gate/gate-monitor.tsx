"use client";

import * as React from "react";
import {
  Check,
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
  History,
  QrCode,
  ArrowRightLeft,
} from "lucide-react";
import { ScanResult, ScannerScreenState } from "./types";
import { ThemeToggle } from "../theme-toggle";

function playChime(type: "allow" | "deny") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "allow") {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);
    } else {
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
  } catch { }
}

const RESET_TIMEOUT_SECONDS = parseInt(
  process.env.NEXT_PUBLIC_SCAN_TIMEOUT_SECONDS || "600",
  10
);

export function GateMonitor() {
  const [screenState, setScreenState] = React.useState<ScannerScreenState>("IDLE");
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
  const [serialStatus, setSerialStatus] = React.useState<"disconnected" | "connected">("disconnected");

  const resetTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const processScanRef = React.useRef<((rawInput: string) => void) | null>(null);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("gate_scan_history");
      if (stored) setScanHistory(JSON.parse(stored));
    } catch (e) { }
  }, []);

  const appendScanHistory = React.useCallback((result: ScanResult) => {
    setScanHistory((prev) => {
      const MAX_HISTORY = parseInt(process.env.NEXT_PUBLIC_MAX_LOCAL_LOGS || "10000", 10);
      const next = [result, ...prev].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem("gate_scan_history", JSON.stringify(next));
      } catch (e) { }
      return next;
    });
  }, []);

  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setCurrentDate(now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      const now = Date.now();
      if (now - lastKeyTime > 300) buffer = "";
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
  }, [soundEnabled, isProcessing]);

  const startResetTimer = React.useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setCountdown(RESET_TIMEOUT_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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

  const processScanInput = async (rawInput: string) => {
    if (!rawInput || isProcessing) return;
    setIsProcessing(true);
    setScreenState("PROCESSING");

    let parsedMode: "entry" | "exit" | undefined = undefined;
    try {
      let token = rawInput;
      let extraPayload: any = {};
      try {
        const parsed = JSON.parse(rawInput);
        if (parsed.token) token = parsed.token;
        if (parsed.mode === "entry" || parsed.mode === "exit") {
          parsedMode = parsed.mode;
        } else if (parsed.mode) {
          parsedMode = parsed.mode;
        }
        if (parsed.isSimulation) extraPayload = parsed;
      } catch { }

      const res = await fetch("/frontend/api/gate/process/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          mode: parsedMode,
          raw: rawInput,
          ...extraPayload,
        }),
      });
      const data = await res.json();

      const result: ScanResult = {
        id: Math.random().toString(36).substring(2, 9),
        status: data.status === "ALLOWED" ? "ALLOWED" : "DENIED",
        flag: data.flag || (data.status === "ALLOWED" ? "NORMAL_ENTRY" : "DENIED"),
        mode: (data.mode || parsedMode || "entry") as "entry" | "exit",
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
      if (soundEnabled) playChime(result.status === "ALLOWED" ? "allow" : "deny");
      startResetTimer();
    } catch (err: any) {
      const errorResult: ScanResult = {
        id: Math.random().toString(36).substring(2, 9),
        status: "DENIED",
        flag: "SCAN_ERROR",
        mode: (parsedMode || "entry") as "entry" | "exit",
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

  React.useEffect(() => {
    processScanRef.current = processScanInput;
  }, [processScanInput]);

  // Poll the NextJS local relay API every 250ms for scans arriving from the Python script
  React.useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/frontend/api/gate/local_relay/");
        const data = await res.json();
        if (data.hasScan && data.raw && processScanRef.current) {
          processScanRef.current(data.raw);
        }
      } catch (err) {
        // Ignore fetch errors during polling to prevent console spam if server is restarting
      }
    }, 250);
    return () => clearInterval(pollInterval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
        setIsFullscreen(false);
      }
    }
  };

  React.useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleSimulate = (scenario: "normal_entry" | "assets_entry" | "normal_exit" | "denied") => {
    if (scenario === "normal_entry") {
      processScanInput(JSON.stringify({ token: "demo_token_normal_entry", mode: "entry", roll: "21CS10042", name: "Abhinav Singh", laptop: null, extra: [], isSimulation: true }));
    } else if (scenario === "assets_entry") {
      processScanInput(JSON.stringify({ token: "demo_token_assets_entry", mode: "entry", roll: "22EE30018", name: "Shruti Sharma", laptop: "MacBook Pro M3 - SN: C02X892J", extra: [{ type: "books", name: "Introduction to Algorithms (CLRS)" }, { type: "books", name: "Operating System Concepts" }, { type: "gadgets", name: "Sony WH-1000XM5 Headphones" }], isSimulation: true }));
    } else if (scenario === "normal_exit") {
      processScanInput(JSON.stringify({ token: "demo_token_normal_exit", mode: "exit", roll: "21CS10042", name: "Abhinav Singh", laptop: "Dell Latitude 5420", extra: [{ type: "books", name: "Data Communications & Networking" }], isSimulation: true }));
    } else {
      processScanInput(JSON.stringify({ token: "demo_token_denied", scenario: "denied", isSimulation: true }));
    }
  };

  const books = activeScan?.extra?.filter((item) => item.type === "books" || item.type === "book") || [];
  const gadgets = activeScan?.extra?.filter((item) => item.type === "gadgets" || item.type === "gadget") || [];

  const allGreen = process.env.NEXT_PUBLIC_ALL_GREEN === "true";

  const isSuccess = activeScan?.status === "ALLOWED";
  const isExit = isSuccess && activeScan?.mode === "exit";

  const statusBgClass = allGreen ? "bg-[#059669] dark:bg-[#10B981]" : (!isSuccess ? "bg-[#DC2626] dark:bg-[#F43F5E]" : isExit ? "bg-[#EA580C] dark:bg-[#F97316]" : "bg-[#059669] dark:bg-[#10B981]");
  const statusTextClass = allGreen ? "text-[#059669] dark:text-[#10B981]" : (!isSuccess ? "text-[#DC2626] dark:text-[#F43F5E]" : isExit ? "text-[#EA580C] dark:text-[#F97316]" : "text-[#059669] dark:text-[#10B981]");

  return (
    <div className="min-h-screen bg-[#F5F7FA] dark:bg-[#0F172A] text-[#172033] dark:text-[#F1F5F9] font-sans flex flex-col selection:bg-blue-200 dark:selection:bg-blue-900/50">

      {/* Header */}
      <header className="h-[64px] sm:h-[72px] bg-white dark:bg-[#111827] border-b border-[#D9E0E8] dark:border-[#2A3648] px-4 sm:px-6 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2 border-r border-[#D9E0E8] dark:border-[#2A3648] pr-3 sm:pr-4">
            <img src="/frontend/devsoc-logo.jpg" alt="DevSoc Logo" className="h-6 sm:h-7 w-auto rounded-[4px] dark:mix-blend-screen opacity-90" />
            <img src="/frontend/gymkhana-logo.png" alt="TSG Logo" className="h-6 sm:h-7 w-auto bg-black rounded-[4px] p-0.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[14px] sm:text-[15px] tracking-wide text-[#172033] dark:text-[#F1F5F9]">
                CENTRAL LIBRARY
              </span>
              <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8] font-medium hidden sm:inline-block">
                Gate Monitor
              </span>
            </div>
          </div>
        </div>

        {/* Center Status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#F5F7FA] dark:bg-[#0F172A] rounded-[6px] border border-[#D9E0E8] dark:border-[#2A3648] text-[13px] text-[#64748B] dark:text-[#94A3B8]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#059669] dark:bg-[#10B981]"></span>
          <span className="font-medium">Scanner Online</span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <span className="font-mono text-[14px] font-semibold text-[#172033] dark:text-[#F1F5F9]">
              {currentTime || "00:00:00"}
            </span>
            <span className="text-[12px] text-[#64748B] dark:text-[#94A3B8] font-medium">
              {currentDate}
            </span>
          </div>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-[6px] border border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] transition-colors"
            title={soundEnabled ? "Sound enabled" : "Sound muted"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <ThemeToggle className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-[6px] border border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] transition-colors" />

          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-[6px] border border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Monitor"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            className="h-9 sm:h-10 px-3 flex items-center gap-1.5 rounded-[6px] border border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] transition-colors font-medium text-[13px]"
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Log</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1050px] mx-auto px-4 sm:px-6 py-10 flex flex-col relative">

        {screenState === "IDLE" && (
          <div className="flex flex-col items-center justify-center mt-12 sm:mt-24">
            <div className="w-16 h-16 rounded-[12px] border border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] flex items-center justify-center mb-6 shadow-sm">
              <QrCode className="w-8 h-8 text-[#64748B] dark:text-[#94A3B8]" />
            </div>
            <h1 className="text-[18px] sm:text-[20px] font-semibold text-[#172033] dark:text-[#F1F5F9] mb-2">SCANNER READY</h1>
            <p className="text-[14px] sm:text-[15px] text-[#64748B] dark:text-[#94A3B8] mb-8">Present a valid library pass to the scanner.</p>
          </div>
        )}

        {screenState === "PROCESSING" && (
          <div className="flex flex-col items-center justify-center mt-24">
            <div className="w-10 h-10 border-[3px] border-[#D9E0E8] dark:border-[#2A3648] border-t-[#2563EB] dark:border-t-[#60A5FA] rounded-full animate-spin mb-6"></div>
            <h2 className="text-[18px] font-semibold text-[#172033] dark:text-[#F1F5F9] mb-2">Processing...</h2>
            <p className="text-[14px] text-[#64748B] dark:text-[#94A3B8]">Verifying pass</p>
          </div>
        )}

        {screenState === "RESULT" && activeScan && (
          <div className="w-full bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[10px] sm:rounded-[12px] shadow-sm relative overflow-hidden animate-in fade-in duration-200">
            {/* Top Accent Line */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${statusBgClass}`}></div>

            <div className="p-5 sm:p-8 pt-6 sm:pt-10">
              {/* Status Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 sm:mb-8 pb-5 sm:pb-6 border-b border-[#D9E0E8] dark:border-[#2A3648] gap-4 sm:gap-6">

                {/* Left: Primary Status */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1">
                  {isSuccess ? (
                    isExit ? <ArrowRightLeft className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${statusTextClass}`} /> : <CheckCircle2 className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${statusTextClass}`} />
                  ) : (
                    <XCircle className={`w-7 h-7 sm:w-8 sm:h-8 shrink-0 ${statusTextClass}`} />
                  )}
                  <div className="min-w-0">
                    <h2 className="text-[20px] sm:text-[24px] font-bold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide truncate">
                      {isSuccess ? (activeScan.mode === 'exit' ? "EXIT PERMITTED" : "ENTRY PERMITTED") : "ACCESS DENIED"}
                    </h2>
                    <p className="text-[14px] sm:text-[15px] text-[#64748B] dark:text-[#94A3B8] truncate">
                      {isSuccess ? "Student pass verified" : "Verification failed"}
                    </p>
                  </div>
                </div>

                {/* Center: Item Indicators */}
                <div className="flex items-center gap-2 sm:gap-3 lg:justify-center">
                  {/* Laptop */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border ${activeScan.laptop
                      ? 'bg-[#F5F7FA] dark:bg-[#1E293B] border-[#D9E0E8] dark:border-[#2A3648] text-[#172033] dark:text-[#F1F5F9]'
                      : 'bg-transparent border-transparent text-[#94A3B8] dark:text-[#64748B] opacity-60'
                    }`}>
                    <Laptop className="w-4 h-4" />
                    {activeScan.laptop && <Check className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />}
                  </div>

                  {/* Books */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border ${books.length > 0
                      ? 'bg-[#F5F7FA] dark:bg-[#1E293B] border-[#D9E0E8] dark:border-[#2A3648] text-[#172033] dark:text-[#F1F5F9]'
                      : 'bg-transparent border-transparent text-[#94A3B8] dark:text-[#64748B] opacity-60'
                    }`}>
                    <BookOpen className="w-4 h-4" />
                    {books.length > 0 && <span className="text-[13px] font-bold leading-none">{books.length}</span>}
                  </div>

                  {/* Gadgets */}
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] border ${gadgets.length > 0
                      ? 'bg-[#F5F7FA] dark:bg-[#1E293B] border-[#D9E0E8] dark:border-[#2A3648] text-[#172033] dark:text-[#F1F5F9]'
                      : 'bg-transparent border-transparent text-[#94A3B8] dark:text-[#64748B] opacity-60'
                    }`}>
                    <Headphones className="w-4 h-4" />
                    {gadgets.length > 0 && <span className="text-[13px] font-bold leading-none">{gadgets.length}</span>}
                  </div>
                </div>

                {/* Right: Metadata */}
                <div className="text-left lg:text-right flex-1">
                  <div className="text-[13px] font-semibold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wide">
                    {activeScan.flag}
                  </div>
                  <div className="text-[13px] text-[#64748B] dark:text-[#94A3B8] font-mono">
                    {activeScan.timestamp}
                  </div>
                </div>
              </div>

              {/* Student Record */}
              <div className="bg-[#F8FAFC] dark:bg-[#172033] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[8px] sm:rounded-[10px] p-4 sm:p-6 mb-6 sm:mb-8">
                <div className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-2">STUDENT</div>
                <div className="text-[26px] sm:text-[32px] font-bold text-[#172033] dark:text-[#F1F5F9] leading-tight tracking-tight">
                  {activeScan.name || "Unknown"}
                </div>
                <div className="text-[15px] sm:text-[16px] text-[#64748B] dark:text-[#94A3B8] font-mono mt-1">
                  {activeScan.roll || "Unknown ID"}
                </div>
              </div>

              {/* Dynamic Content (Success Items vs Error Message) */}
              {isSuccess ? (
                <div>
                  <div className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-4">REGISTERED ITEMS</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">

                    {/* Laptop */}
                    <div className="bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[8px] p-4">
                      <div className="flex items-center gap-2 mb-3 text-[#64748B] dark:text-[#94A3B8]">
                        <Laptop className="w-4 h-4" />
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Laptop</span>
                      </div>
                      <div className="text-[14px] text-[#172033] dark:text-[#F1F5F9] font-medium leading-relaxed">
                        {activeScan.laptop || <span className="text-[#94A3B8] dark:text-[#64748B] font-normal">None</span>}
                      </div>
                    </div>

                    {/* Books */}
                    <div className="bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[8px] p-4">
                      <div className="flex items-center gap-2 mb-3 text-[#64748B] dark:text-[#94A3B8]">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Books</span>
                        {books.length > 0 && <span className="ml-auto text-[12px] font-semibold">{books.length}</span>}
                      </div>
                      {books.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {books.map((b, i) => (
                            <div key={i} className="text-[14px] text-[#172033] dark:text-[#F1F5F9] font-medium leading-snug">{b.name}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[14px] text-[#94A3B8] dark:text-[#64748B]">None</div>
                      )}
                    </div>

                    {/* Gadgets */}
                    <div className="bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[8px] p-4">
                      <div className="flex items-center gap-2 mb-3 text-[#64748B] dark:text-[#94A3B8]">
                        <Headphones className="w-4 h-4" />
                        <span className="text-[12px] font-semibold uppercase tracking-wider">Gadget</span>
                        {gadgets.length > 0 && <span className="ml-auto text-[12px] font-semibold">{gadgets.length}</span>}
                      </div>
                      {gadgets.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {gadgets.map((g, i) => (
                            <div key={i} className="text-[14px] text-[#172033] dark:text-[#F1F5F9] font-medium leading-snug">{g.name}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[14px] text-[#94A3B8] dark:text-[#64748B]">None</div>
                      )}
                    </div>

                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[12px] font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider mb-4">ERROR DETAILS</div>
                  <div className="bg-[#FEF2F2] dark:bg-[rgba(244,63,94,0.05)] border-l-4 border-[#DC2626] dark:border-[#F43F5E] rounded-r-[8px] p-4 sm:p-5">
                    <div className="text-[15px] font-medium text-[#DC2626] dark:text-[#F43F5E] mb-1">
                      {activeScan.message || "Token expired or invalid"}
                    </div>
                    <div className="text-[14px] text-[#DC2626]/80 dark:text-[#F43F5E]/80">
                      If this is unexpected, verify that the QR code was generated recently and that the student credentials are valid.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-clear footer */}
            <div className="px-5 sm:px-8 py-3 sm:py-4 bg-[#F8FAFC] dark:bg-[#172033] border-t border-[#D9E0E8] dark:border-[#2A3648] flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 flex-1">
                <span className="text-[13px] font-medium text-[#64748B] dark:text-[#94A3B8] w-[140px]">
                  Auto-clears in {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')}
                </span>
                <div className="flex-1 h-[4px] bg-[#D9E0E8] dark:bg-[#2A3648] rounded-full overflow-hidden max-w-[200px]">
                  <div
                    className={`h-full transition-all duration-1000 ease-linear rounded-full ${statusBgClass}`}
                    style={{ width: `${(countdown / RESET_TIMEOUT_SECONDS) * 100}%` }}
                  ></div>
                </div>
              </div>
              <button
                onClick={clearCurrentScan}
                className="text-[13px] font-medium text-[#2563EB] dark:text-[#60A5FA] hover:underline"
              >
                Clear Now
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Manual Input (For Testing) */}
      {showManualInput && (
        <div className="w-full max-w-[1050px] mx-auto px-4 sm:px-6 mb-4">
          <div className="bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[8px] p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-semibold text-[#172033] dark:text-[#F1F5F9] uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Manual Token Input
              </span>
              <button onClick={() => setShowManualInput(false)} className="text-[12px] text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9]">
                ✕ Close
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste token or payload..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && manualToken.trim()) {
                    processScanInput(manualToken.trim());
                    setManualToken("");
                    setShowManualInput(false);
                  }
                }}
                className="flex-1 bg-[#F5F7FA] dark:bg-[#0F172A] border border-[#D9E0E8] dark:border-[#2A3648] rounded-[6px] px-3 py-2 text-[13px] font-mono text-[#172033] dark:text-[#F1F5F9] focus:outline-none focus:border-[#C7D0DC] dark:focus:border-[#64748B]"
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
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#D9E0E8] dark:disabled:bg-[#2A3648] disabled:text-[#94A3B8] text-white rounded-[6px] text-[13px] font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="shrink-0 border-t border-[#D9E0E8] dark:border-[#2A3648] bg-white dark:bg-[#111827] py-3 px-4 sm:px-6 z-20 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#64748B] dark:text-[#94A3B8]">
        <div className="flex items-center gap-2 font-medium">
          <span>Developers' Society X TSG initiative</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <button className="hover:text-[#172033] dark:hover:text-[#F1F5F9] transition-colors flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> Simulation
            </button>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex flex-col gap-1 p-2 rounded-[8px] bg-white dark:bg-[#111827] border border-[#D9E0E8] dark:border-[#2A3648] shadow-lg w-40">
              <button onClick={() => handleSimulate("normal_entry")} className="text-left px-3 py-2 rounded-[6px] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] text-[13px] text-[#172033] dark:text-[#F1F5F9]">Normal Entry</button>
              <button onClick={() => handleSimulate("assets_entry")} className="text-left px-3 py-2 rounded-[6px] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] text-[13px] text-[#172033] dark:text-[#F1F5F9]">Entry w/ Assets</button>
              <button onClick={() => handleSimulate("normal_exit")} className="text-left px-3 py-2 rounded-[6px] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] text-[13px] text-[#172033] dark:text-[#F1F5F9]">Exit Scan</button>
              <button onClick={() => handleSimulate("denied")} className="text-left px-3 py-2 rounded-[6px] hover:bg-[#FEF2F2] dark:hover:bg-[rgba(244,63,94,0.1)] text-[13px] text-[#DC2626] dark:text-[#F43F5E]">Denied Scan</button>
              <div className="h-px bg-[#D9E0E8] dark:bg-[#2A3648] my-1"></div>
              <button onClick={() => setShowManualInput(!showManualInput)} className="text-left px-3 py-2 rounded-[6px] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] text-[13px] text-[#172033] dark:text-[#F1F5F9]">Manual Token</button>
            </div>
          </div>
          <span>&copy; 2026 Developers' Society</span>
        </div>
      </footer>

      {/* Recent Scans Drawer */}
      {showHistory && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[380px] bg-white dark:bg-[#111827] border-l border-[#D9E0E8] dark:border-[#2A3648] z-40 flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#D9E0E8] dark:border-[#2A3648] shrink-0">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#172033] dark:text-[#F1F5F9]" />
              <h3 className="font-semibold text-[15px] text-[#172033] dark:text-[#F1F5F9]">Recent scans</h3>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F5F7FA] dark:hover:bg-[#1E293B] transition-colors">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {scanHistory.length === 0 ? (
              <div className="text-center py-12 text-[14px] text-[#64748B] dark:text-[#94A3B8]">
                No scans recorded in this session.
              </div>
            ) : (
              <div className="flex flex-col">
                {scanHistory.map((scan, idx) => {
                  const isExpanded = expandedIds.has(scan.id);
                  const isSuccessLog = scan.status === "ALLOWED";
                  return (
                    <div
                      key={scan.id}
                      onClick={() => setExpandedIds(prev => { const n = new Set(prev); if (n.has(scan.id)) n.delete(scan.id); else n.add(scan.id); return n; })}
                      className={`p-4 border-b border-[#D9E0E8] dark:border-[#2A3648] cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-[#172033] transition-colors ${idx === 0 ? 'bg-[#F8FAFC] dark:bg-[#172033]' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="shrink-0 mt-0.5">
                          {isSuccessLog ? (
                            scan.mode === 'exit' ? <ArrowRightLeft className="w-4 h-4 text-[#EA580C] dark:text-[#F97316]" /> : <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-[#10B981]" />
                          ) : (
                            <XCircle className="w-4 h-4 text-[#DC2626] dark:text-[#F43F5E]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <div className="text-[14px] font-bold text-[#172033] dark:text-[#F1F5F9] truncate">
                              {scan.name || scan.roll || "UNKNOWN"}
                            </div>
                            <div className="text-[12px] text-[#64748B] dark:text-[#94A3B8] shrink-0 font-mono">
                              {scan.timestamp}
                            </div>
                          </div>
                          {scan.name && (
                            <div className="text-[13px] text-[#64748B] dark:text-[#94A3B8] font-mono mb-1.5">
                              {scan.roll}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider">
                            <span className={isSuccessLog ? (scan.mode === 'exit' ? 'text-[#EA580C] dark:text-[#F97316]' : 'text-[#059669] dark:text-[#10B981]') : 'text-[#DC2626] dark:text-[#F43F5E]'}>
                              {scan.mode}
                            </span>
                            <span className="text-[#94A3B8] dark:text-[#64748B]">·</span>
                            <span className="text-[#64748B] dark:text-[#94A3B8]">{scan.flag}</span>
                          </div>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-[#D9E0E8] dark:border-[#2A3648] text-[13px] text-[#172033] dark:text-[#F1F5F9] space-y-1.5">
                              {scan.laptop && <div><span className="text-[#64748B] dark:text-[#94A3B8]">Laptop:</span> {scan.laptop}</div>}
                              {scan.extra && scan.extra.length > 0 && <div><span className="text-[#64748B] dark:text-[#94A3B8]">Assets:</span> {scan.extra.map((e: any) => e.name).join(", ")}</div>}
                              {scan.message && <div><span className="text-[#64748B] dark:text-[#94A3B8]">Note:</span> {scan.message}</div>}
                              {!scan.laptop && (!scan.extra || scan.extra.length === 0) && !scan.message && <div className="text-[#94A3B8] dark:text-[#64748B] italic">No additional details</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
