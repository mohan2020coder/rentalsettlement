const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1';

/** Base URL used by the API client. */
export { BASE_URL };

export function apiUrl(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${trimmed}`;
}