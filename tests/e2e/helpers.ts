import { expect, request as pwRequest, type APIRequestContext, type Page } from "@playwright/test";

export const PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Technentium#2026";
export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** Authenticated API context for a seeded account (staff/technician actions driven through /api/v1/admin). */
export async function apiAs(email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const res = await ctx.post("/api/test/sign-in", { data: { email, password: PASSWORD } });
  expect(res.ok(), `sign in ${email}`).toBeTruthy();
  return ctx;
}

export async function signInWithEmail(page: Page, email: string, locale = "en") {
  await page.goto(`/${locale}/auth/sign-in`);
  await page.getByRole("tab", { name: /email/i }).click();
  await page.getByRole("textbox", { name: /^email/i }).fill(email);
  await page.getByLabel(/^password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/account\/bookings/);
}

export async function ok<T>(res: Awaited<ReturnType<APIRequestContext["post"]>>): Promise<T> {
  const body = (await res.json()) as { data?: T };
  expect(res.ok(), JSON.stringify(body)).toBeTruthy();
  return body.data as T;
}
