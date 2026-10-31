"use client";
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, phoneNumberClient, twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({ user: { preferredLocale: { type: "string", required: false } } }),
    phoneNumberClient(),
    // Staff sign-in handles the 2FA step itself (it checks `twoFactorRedirect` on the sign-in response).
    twoFactorClient(),
  ],
});
