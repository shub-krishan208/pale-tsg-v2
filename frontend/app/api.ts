import { SessionData } from "@/components/entry-pass/types";

export async function apiCall<T = any>(
  path: string,
  body: SessionData): Promise<{ data?: T }> {
  try {
    
    const baseURL = process.env.BACKEND_URL || "http://localhost:8000";
    const url = `${baseURL}${path}`;

    const res = await fetch(url, {
        method: "POST",
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      console.error('[apiCall] Error response:', { status: res.status, error });
      throw error;
    }

    const data = await res.json();
    return { data };
  } catch (error) {
    console.error('[apiCall] Exception:', error);
    throw error;
  }
}
