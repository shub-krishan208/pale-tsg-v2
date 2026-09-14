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
        laptop: body.laptop || null,
        extra: Array.isArray(body.extra) ? body.extra : [],
        message: `${simDirection.toUpperCase()} permitted`,
        timestamp: new Date().toISOString(),
        isVerified: true,
      });
    }

    // --- 2. Live Token Verification (Common Scanning Mode) ---
    // Try finding public key for RS256 verification
    const possibleKeyPaths = [
      path.join(process.cwd(), "keys", "public.pem"),
      path.join(process.cwd(), "..", "gate", "keys", "public.pem"),
      path.join(process.cwd(), "..", "backend", "keys", "public.pem"),
    ];

    let publicKey: string | null = null;
    for (const keyPath of possibleKeyPaths) {
      if (fs.existsSync(keyPath)) {
        try {
          publicKey = fs.readFileSync(keyPath, "utf-8");
          break;
        } catch {
          // ignore read error
        }
      }
    }

    let payload: any = null;
    let isVerified = false;

    if (publicKey) {
      try {
        payload = jwt.verify(token, publicKey, {
          algorithms: ["RS256"],
        });
        isVerified = true;
      } catch (err: any) {
        if (err.name === "TokenExpiredError") {
          return NextResponse.json({
            success: false,
            status: "DENIED",
            flag: "TOKEN_EXPIRED",
            mode: "entry",
            message: "Token has expired. Please regenerate your pass.",
            timestamp: new Date().toISOString(),
          });
        }
        return NextResponse.json({
          success: false,
          status: "DENIED",
          flag: "INVALID_SIGNATURE",
          mode: "entry",
          message: `Verification failed: ${err.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      // Fallback decode without signature verification (dev / offline mode)
      try {
        payload = jwt.decode(token);
        if (!payload || typeof payload !== "object") {
          payload = JSON.parse(token);
        }
      } catch {
        try {
          payload = JSON.parse(token);
        } catch {
          return NextResponse.json({
            success: false,
            status: "DENIED",
            flag: "INVALID_TOKEN",
            mode: "entry",
            message: "Malformed token. Unable to decode scan payload.",
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (!payload) {
      return NextResponse.json({
        success: false,
        status: "DENIED",
        flag: "INVALID_PAYLOAD",
        mode: "entry",
        message: "Token payload is empty or unreadable.",
        timestamp: new Date().toISOString(),
      });
    }

    // Determine direction from token claims (Common Mode automatically supports both Entry and Exit)
    const tokenAction = (payload.action || payload.type || "").toUpperCase();
    const resolvedMode =
      tokenAction.includes("EXIT") || body.mode === "exit" ? "exit" : "entry";

    let flag = resolvedMode === "entry" ? "NORMAL_ENTRY" : "NORMAL_EXIT";
    if (payload.flag) {
      flag = payload.flag;
    } else if (payload.type === "emergency" || tokenAction.includes("EMERGENCY")) {
      flag = "EMERGENCY_EXIT";
    }

    const roll = payload.roll || payload.rollNumber || payload.sub || "UNKNOWN";
    const laptop = payload.laptop || null;
    const extra = Array.isArray(payload.extra) ? payload.extra : [];

    return NextResponse.json({
      success: true,
      status: "ALLOWED",
      flag,
      mode: resolvedMode,
      roll,
      laptop,
      extra,
      message: `${resolvedMode.toUpperCase()} verified successfully`,
      timestamp: new Date().toISOString(),
      isVerified,
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
