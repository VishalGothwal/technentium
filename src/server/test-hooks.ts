/**
 * E2E-only behaviour (OTP capture, relaxed rate limits). Requires E2E_TEST_HOOKS=1 and is
 * always off in production builds.
 */
export const testHooksEnabled = () => process.env.NODE_ENV !== "production" && process.env.E2E_TEST_HOOKS === "1";
