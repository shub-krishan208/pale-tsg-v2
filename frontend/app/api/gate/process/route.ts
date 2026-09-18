import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { token, isSimulation = false, scenario } = body;

    // Support payload passed directly as JSON string or object
    if (!token && body.raw) {
      try {
        const parsed = JSON.parse(body.raw);
        token = parsed.token || body.raw;
        if (parsed.isSimulation) {
          isSimulation = true;
        }
      } catch {
        token = body.raw;
      }
    }

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          status: "DENIED",
          flag: "DENIED",
          message: "No token provided for scanning",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // --- 1. Handle Built-in Simulation Scenarios ---
    if (
      isSimulation ||
      (typeof token === "string" && token.startsWith("demo_token_"))
    ) {
      if (token === "demo_token_denied" || scenario === "denied") {
        return NextResponse.json({
          success: false,
          status: "DENIED",
          flag: "TOKEN_EXPIRED",
          mode: "entry",
          message: "Token has expired. Please regenerate your pass.",
          timestamp: new Date().toISOString(),
        });
      }

      const simDirection =
        body.mode || (token.includes("exit") ? "exit" : "entry");

      return NextResponse.json({
        success: true,
        status: "ALLOWED",
        flag: simDirection === "entry" ? "NORMAL_ENTRY" : "NORMAL_EXIT",
        mode: simDirection,
        roll: body.roll || "21CS10042",
        name: body.name || null,
        laptop: body.laptop || null,
        extra: Array.isArray(body.extra) ? body.extra : [],
        message: `${simDirection.toUpperCase()} permitted`,
        timestamp: new Date().toISOString(),
        isVerified: true,
      });
    }

    // --- 2. Live Token Verification (Forward to Django Gate Backend) ---
    // The gate backend handles DB persistence and calls process_token logic
    const gateBackendUrl = process.env.GATE_LOCAL_API_URL || "http://gate:8000";
    
    const res = await fetch(`${gateBackendUrl}/api/process_scan/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, mode: body.mode || "entry" }),
    });

    const data = await res.json();
    
    if (!res.ok || !data.success) {
      return NextResponse.json({
        success: false,
        status: "DENIED",
        flag: data.flag || "ERROR",
        mode: data.mode || "entry",
        message: data.message || data.error || "Verification failed",
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      status: "ALLOWED",
      flag: data.flag,
      mode: data.mode,
      roll: data.roll,
      name: data.name,
      laptop: data.laptop,
      extra: data.extra || [],
      message: data.message,
      timestamp: new Date().toISOString(),
      isVerified: true,
    });
  } catch (error: any) {
    console.error("Gate scan process error:", error);
    return NextResponse.json(
      {
        success: false,
        status: "DENIED",
        flag: "ERROR",
        message: `System Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
