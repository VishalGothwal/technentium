"use client";

export type ApiError = { code: string; messageKey: string; message: string; fields?: Record<string, string> };

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly error: ApiError,
  ) {
    super(error.message);
  }
}

/** Fetch an `/api/v1` endpoint and unwrap `{ data }`; throws ApiRequestError with the server's localised message. */
export async function apiFetch<T>(path: string, init: RequestInit & { locale?: string } = {}): Promise<T> {
  const { locale, headers, ...rest } = init;
  const res = await fetch(path, { ...rest, headers: { "Accept-Language": locale ?? "en", ...headers } });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: ApiError };
  if (!res.ok || body.error) {
    throw new ApiRequestError(res.status, body.error ?? { code: "INTERNAL", messageKey: "errors.generic", message: "Something went wrong" });
  }
  return body.data as T;
}
