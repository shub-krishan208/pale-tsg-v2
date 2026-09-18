import { NextResponse } from "next/server";

// A simple global memory queue to act as a bridge between the Python daemon and the React UI.
// Using globalThis ensures the queue survives hot-reloads in Next.js development mode.
if (!(globalThis as any).scanQueue) {
  (globalThis as any).scanQueue = [];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.raw) {
      (globalThis as any).scanQueue.push(body.raw);
      return NextResponse.json({ success: true, queued: true });
    }
    return NextResponse.json({ success: false, error: "No raw payload" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const queue = (globalThis as any).scanQueue;
  if (queue && queue.length > 0) {
    // Pop the oldest scan from the queue
    const raw = queue.shift();
    return NextResponse.json({ hasScan: true, raw });
  }
  return NextResponse.json({ hasScan: false });
}
