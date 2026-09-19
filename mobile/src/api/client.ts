import { apiUrl } from './config';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  asBlob?: boolean;
}

/**
 * Minimal HTTP client with token authentication and a 401-triggered refresh.
 * The refresh flow uses the stored refresh token; a failing refresh signs the
 * user out (handled by the auth context via onSessionExpired).
 */
class ApiClient {
  accessToken: string | null = null;
  refreshToken: string | null = null;
  onTokenRefreshed?: (access: string, refresh: string) => void;
  onSessionExpired?: () => void;

  private refreshing: Promise<boolean> | null = null;

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    try {
      return await this.doFetch(path, options);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && this.refreshToken) {
        const ok = await this.refresh();
        if (!ok) {
          this.onSessionExpired?.();
          throw err;
        }
        return this.doFetch(path, options);
      }
      throw err;
    }
  }

  private async doFetch<T>(path: string, options: RequestOptions): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    let resp: Response;
    try {
      resp = await fetch(apiUrl(path), {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch {
      throw new NetworkError();
    }

    if (options.asBlob) {
      if (!resp.ok) {
        throw await this.errorFrom(resp);
      }
      return (await resp.blob()) as unknown as T;
    }

    let payload: unknown = null;
    const text = await resp.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!resp.ok) {
      const envelope = payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
      throw new ApiError(
        resp.status,
        envelope?.error?.code ?? 'REQUEST_FAILED',
        envelope?.error?.message ?? `Request failed with status ${resp.status}`,
        envelope?.error?.details,
      );
    }

    // Envelope unwrap: { success, data }.
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) {
      return false;
    }
    try {
      const client = new ApiClient();
      const data = await client.request<{
        access_token: string;
        refresh_token: string;
        expires_in: number;
      }>('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
      });
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.onTokenRefreshed?.(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  private async errorFrom(resp: Response): Promise<ApiError> {
    try {
      const payload = (await resp.json()) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
      };
      return new ApiError(
        resp.status,
        payload.error?.code ?? 'REQUEST_FAILED',
        payload.error?.message ?? `Request failed with status ${resp.status}`,
        payload.error?.details,
      );
    } catch {
      return new ApiError(resp.status, 'REQUEST_FAILED', `Request failed with status ${resp.status}`);
    }
  }

  async download(path: string): Promise<{ blob: Blob; filename: string }> {
    const headers: Record<string, string> = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
    let resp: Response;
    try {
      resp = await fetch(apiUrl(path), { method: 'GET', headers });
    } catch {
      throw new NetworkError();
    }
    if (!resp.ok) {
      throw await this.errorFrom(resp);
    }
    const disposition = resp.headers.get('Content-Disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    return { blob: await resp.blob(), filename: match?.[1] ?? 'evidence.pdf' };
  }
}

export const api = new ApiClient();