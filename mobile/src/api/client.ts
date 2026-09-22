import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiError, AuthResponse, Envelope } from './types';

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ||
  'http://localhost:8080/api/v1';

const ACCESS_TTL_MS = 14 * 60 * 1000;

interface TokenProviders {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (access: string, refresh: string) => void;
  onSessionExpired: () => void;
}

let providers: TokenProviders | null = null;

export function registerTokenProviders(p: TokenProviders) {
  providers = p;
}

let accessExpiresAt = 0;

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, string>;

  constructor(message: string, code: string, status: number, details?: Record<string, string>) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function extractError(err: unknown): ApiClientError {
  if (err instanceof ApiClientError) {
    return err;
  }
  if (axios.isAxiosError(err)) {
    const aerr = err as AxiosError<{ error?: ApiError }>;
    const body = aerr.response?.data?.error;
    if (body) {
      return new ApiClientError(body.message, body.code, aerr.response?.status ?? 500, body.details);
    }
    return new ApiClientError(
      aerr.message || 'Network error',
      'NETWORK_ERROR',
      aerr.response?.status ?? 0,
    );
  }
  return new ApiClientError('Unexpected error', 'UNKNOWN', 0);
}

async function refreshTokens(): Promise<boolean> {
  if (!providers) {
    return false;
  }
  const refreshToken = providers.getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  try {
    const resp = await axios.post<Envelope<AuthResponse>>(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    if (resp.data?.success && resp.data.data?.access_token) {
      providers.setTokens(resp.data.data.access_token, resp.data.data.refresh_token);
      accessExpiresAt = Date.now() + ACCESS_TTL_MS;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const access = providers?.getAccessToken() ?? null;
  const isAuthCall = typeof config.url === 'string' && config.url.includes('/auth/');
  const expired = accessExpiresAt > 0 && Date.now() >= accessExpiresAt;

  if (access && (isAuthCall || !expired)) {
    config.headers.set('Authorization', `Bearer ${access}`);
  } else if (access && expired && !isAuthCall) {
    const ok = await refreshTokens();
    const fresh = providers?.getAccessToken();
    if (ok && fresh) {
      config.headers.set('Authorization', `Bearer ${fresh}`);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = error.response?.status;
    const isAuthCall = typeof original?.url === 'string' && original.url.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const ok = await refreshTokens();
      if (ok) {
        const fresh = providers?.getAccessToken();
        if (fresh) {
          original.headers.set('Authorization', `Bearer ${fresh}`);
          return api(original);
        }
      }
      providers?.onSessionExpired();
    }
    throw error;
  },
);

export async function post<T>(url: string, body?: unknown): Promise<T> {
  try {
    const resp = await api.post<Envelope<T>>(url, body ?? {});
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  try {
    const resp = await api.put<Envelope<T>>(url, body ?? {});
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  try {
    const resp = await api.patch<Envelope<T>>(url, body ?? {});
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function get<T>(url: string): Promise<T> {
  try {
    const resp = await api.get<Envelope<T>>(url);
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function del<T>(url: string): Promise<T> {
  try {
    const resp = await api.delete<Envelope<T>>(url);
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function download(url: string): Promise<{ blob: Blob }> {
  try {
    const resp = await api.get(url, { responseType: 'blob' });
    return { blob: resp.data as Blob };
  } catch (err) {
    throw extractError(err);
  }
}

export async function rawAuth<T>(url: string, body: unknown): Promise<T> {
  try {
    const resp = await axios.post<Envelope<T>>(`${API_BASE_URL}${url}`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export async function upload<T>(url: string, form: FormData): Promise<T> {
  try {
    const access = providers?.getAccessToken() ?? null;
    const resp = await axios.post<Envelope<T>>(`${API_BASE_URL}${url}`, form, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      timeout: 60000,
      transformRequest: [(data) => data],
    });
    return resp.data.data;
  } catch (err) {
    throw extractError(err);
  }
}

export function mediaUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const clean = key.replace(/^\/+/, '');
  return `${API_BASE_URL}/storage/${clean}`;
}