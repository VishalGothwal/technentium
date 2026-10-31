import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { apiAs, ok, signInWithEmail } from "./helpers";

/**
 * PRD §15.3 scenarios 1–7, 11, 12. The customer's journey runs through the UI; staff and
 * technician steps go through the admin API (the same services the admin UI calls), which keeps
 * the test independent of admin layout details.
 */

async function bookThroughWizard(page: import("@playwright/test").Page) {
  await page.goto("/en/repairs/book");
  await page.getByRole("radio", { name: "Mobile phone" }).check();
  await page.getByRole("radio", { name: "Apple" }).check();
  await page.getByRole("radio", { name: "iPhone 13" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("checkbox", { name: "Broken or cracked screen" }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Describe the problem").fill("Dropped it; the screen is cracked across the top.");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("radio", { name: /Pickup & drop/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/^Name/).fill("E2E Customer");
  await page.getByLabel(/^Mobile number/).fill("9876543210");
  await page.getByLabel(/House \/ flat, street/).fill("12 MI Road, near GPO");
  await page.getByLabel(/^Pincode/).fill("302001");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.locator('input[name="slot"]:not([disabled])').first().check({ force: true });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByText("Diagnosis fee", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: /I have read the/ }).check();
  await page.getByRole("button", { name: "Submit booking" }).click();

  await expect(page.getByRole("heading", { name: "Booking received" })).toBeVisible({ timeout: 60_000 });
  const text = await page.getByText(/Your booking reference is/).textContent();
  return text!.match(/TN-\d{4}-\d{5}/)![0];
}

async function jobForReference(staff: import("@playwright/test").APIRequestContext, reference: string) {
  // Booking id from the staff queue page, job id after confirmation.
  const html = await (await staff.get(`/admin/bookings?status=SUBMITTED&q=${reference}`)).text();
  const bookingId = html.match(/\/admin\/bookings\/(c[a-z0-9]{20,})/)![1];
  return bookingId;
}

test.describe("repair journey", () => {
  test("book → confirm → diagnose → quote → approve → repair → return", async ({ page }) => {
    await signInWithEmail(page, "customer@technentium.test");
    const reference = await bookThroughWizard(page);

    // Customer sees pending confirmation.
    await page.goto(`/en/account/bookings/${reference}`);
    await expect(page.getByText("Awaiting confirmation").first()).toBeVisible();

    const staff = await apiAs("staff@technentium.test");
    const tech = await apiAs("tech@technentium.test");
    const bookingId = await jobForReference(staff, reference);

    // Technicians cannot confirm bookings (scenario 11).
    expect((await tech.post(`/api/v1/admin/repair/bookings/${bookingId}/confirm`, { data: {} })).status()).toBe(403);

    const techUserId = (await (await tech.get("/api/auth/get-session")).json()).user.id as string;
    await ok(await staff.post(`/api/v1/admin/repair/bookings/${bookingId}/confirm`, { data: { technicianId: techUserId } }));
    const jobHtml = await (await staff.get(`/admin/bookings/${bookingId}`)).text();
    const jobId = jobHtml.match(/\/admin\/jobs\/(c[a-z0-9]{20,})/)![1];

    await ok(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "DEVICE_RECEIVED" } }));
    await ok(await tech.post(`/api/v1/admin/repair/jobs/${jobId}/inspection`, { data: { receiptCondition: "Cracked display, frame fine" } }));
    await ok(await tech.post(`/api/v1/admin/repair/jobs/${jobId}/diagnosis`, { data: { findings: "Display assembly damaged" } }));
    const { versionId } = await ok<{ versionId: string }>(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/quotes`));
    const totals = await ok<{ totalPaise: number }>(
      await staff.put(`/api/v1/admin/repair/quotes/${versionId}`, {
        data: { lines: [{ kind: "PART", description: "Display assembly", quantity: 1, unitPaise: 349900 }, { kind: "LABOUR", description: "Labour", quantity: 1, unitPaise: 49900 }] },
      }),
    );
    expect(totals.totalPaise).toBe(471764);
    await ok(await staff.post(`/api/v1/admin/repair/quotes/${versionId}/send`));

    // Customer approves in the UI and sees the same total the server computed.
    await page.goto(`/en/account/bookings/${reference}`);
    await expect(page.getByText("₹4,717.64")).toBeVisible();
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(axe.violations.filter((v) => v.impact === "critical")).toEqual([]);
    await page.getByRole("button", { name: "Approve quote" }).click();
    await page.getByRole("button", { name: "Yes, approve" }).click();
    await expect(page.getByText("Your quote is approved")).toBeVisible();

    // Repair → QC → ready → handover.
    await ok(await tech.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "IN_PROGRESS" } }));
    await ok(await tech.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "QUALITY_CHECK" } }));
    // Guard: no passed QC yet.
    expect((await tech.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "READY_FOR_RETURN" } })).status()).toBe(409);

    await page.reload();
    await expect(page.getByText("Quality check").first()).toBeVisible();

    // A different customer cannot open this booking (scenario 12).
    const other = await apiAs("owner@technentium.test");
    expect((await other.get(`/api/v1/repair/bookings/${reference}`)).status()).toBe(404);
  });

  test("decline → choose return method → return coordination", async ({ page }) => {
    await signInWithEmail(page, "customer@technentium.test");
    const reference = await bookThroughWizard(page);
    const staff = await apiAs("staff@technentium.test");
    const bookingId = await jobForReference(staff, reference);
    await ok(await staff.post(`/api/v1/admin/repair/bookings/${bookingId}/confirm`, { data: {} }));
    const jobId = (await (await staff.get(`/admin/bookings/${bookingId}`)).text()).match(/\/admin\/jobs\/(c[a-z0-9]{20,})/)![1];
    await ok(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "DEVICE_RECEIVED" } }));
    await ok(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/inspection`, { data: { receiptCondition: "Screen cracked" } }));
    await ok(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/diagnosis`, { data: { findings: "Needs new display" } }));
    const { versionId } = await ok<{ versionId: string }>(await staff.post(`/api/v1/admin/repair/jobs/${jobId}/quotes`));
    await ok(await staff.put(`/api/v1/admin/repair/quotes/${versionId}`, { data: { lines: [{ kind: "PART", description: "Display", quantity: 1, unitPaise: 899900 }] } }));
    await ok(await staff.post(`/api/v1/admin/repair/quotes/${versionId}/send`));

    await page.goto(`/en/account/bookings/${reference}`);
    await page.getByRole("button", { name: "Decline" }).click();
    await page.getByRole("radio", { name: /collect it from the shop/ }).check();
    await expect(page.getByText("Diagnosis fee").last()).toBeVisible();
    await page.getByRole("checkbox", { name: /accept these charges/ }).check();
    await page.getByRole("button", { name: "Confirm decline" }).click();
    await expect(page.getByText("We'll arrange your device's return")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Arranging return").first()).toBeVisible();
    // Repair work is blocked after a decline.
    expect((await staff.post(`/api/v1/admin/repair/jobs/${jobId}/status`, { data: { to: "IN_PROGRESS" } })).status()).toBe(409);
  });

  test("language switch keeps the page", async ({ page }) => {
    await page.goto("/en/repairs");
    await page.getByRole("link", { name: "हिन्दी" }).first().click();
    await expect(page).toHaveURL(/\/hi\/repairs$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("डिवाइस रिपेयर");
  });
});

test("mobile OTP sign-in creates an account (needs E2E_TEST_HOOKS=1)", async ({ page, request }) => {
  const hook = await request.get("/api/test/otp?phone=%2B919000000000");
  test.skip(hook.status() === 404, "server not started with E2E_TEST_HOOKS=1");

  const phone = `9${String(Date.now()).slice(-9)}`;
  await page.goto("/en/auth/sign-in");
  await page.waitForLoadState("networkidle"); // let React hydrate before typing
  const input = page.getByRole("textbox", { name: "Mobile number" });
  // Re-fill until the value survives hydration.
  await expect(async () => {
    await input.fill(phone);
    await expect(input).toHaveValue(phone, { timeout: 1000 });
  }).toPass();
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText(/We sent a code/)).toBeVisible();

  const { code } = await (await request.get(`/api/test/otp?phone=${encodeURIComponent(`+91${phone}`)}`)).json();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await page.waitForURL(/\/account\/bookings/);
  await expect(page.getByText("You haven't booked any repairs yet.")).toBeVisible();
});
