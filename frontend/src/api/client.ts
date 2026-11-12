// In dev this is "/api" (proxied by Vite). In production set VITE_API_URL.
const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

const SESSION_KEY = "prepdebt_session";
export const UNAUTHORIZED_EVENT = "prepdebt:unauthorized";

export interface Session {
  token: string;
  email: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    return typeof s.token === "string" && typeof s.email === "string"
      ? { token: s.token, email: s.email }
      : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can be blocked; the in-memory session still works until refresh.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}

function errorMessage(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const d = data as { error?: unknown; details?: { path?: string; message?: string }[] };
    if (Array.isArray(d.details) && d.details.length > 0) {
      return d.details
        .map((x) => (x.path ? `${x.path}: ${x.message}` : String(x.message)))
        .join("; ");
    }
    if (typeof d.error === "string") return d.error;
  }
  return `Request failed (${status})`;
}

interface Options {
  method?: "GET" | "POST";
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as raw CSV text (used by the import endpoint). */
  text?: string;
}

export async function api<T>(path: string, { method = "GET", body, text }: Options = {}): Promise<T> {
  const session = loadSession();
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;

  let payload: string | undefined;
  if (text !== undefined) {
    headers["Content-Type"] = "text/csv";
    payload = text;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running?");
  }

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    // An expired or invalid token: drop the session so the app returns to login.
    if (res.status === 401 && session) {
      clearSession();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(res.status, errorMessage(data, res.status));
  }
  return data as T;
}
