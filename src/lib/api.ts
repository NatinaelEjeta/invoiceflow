/**
 * Tiny typed fetch wrapper for the InvoiceFlow REST API.
 * All server errors arrive as `{ error: string, code?: string }`.
 */

export class ApiError extends Error {
  public status: number;
  public code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiInit {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: init.signal,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => null)) as
    | { error?: string; code?: string }
    | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error || `Request failed with status ${res.status}`,
      data?.code
    );
  }
  return data as T;
}
