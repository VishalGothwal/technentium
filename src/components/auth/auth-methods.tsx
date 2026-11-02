"use client";
import { createContext, useContext, type ReactNode } from "react";

/** Which sign-in methods the Owner has switched on (Admin → Feature controls). Provided by the site layout. */
export type AuthMethods = {
  google: boolean;
  phoneOtp: boolean;
  emailPassword: boolean;
  signUp: boolean;
};

const AuthMethodsContext = createContext<AuthMethods>({
  google: true,
  phoneOtp: true,
  emailPassword: true,
  signUp: true,
});

export function AuthMethodsProvider({ value, children }: { value: AuthMethods; children: ReactNode }) {
  return <AuthMethodsContext.Provider value={value}>{children}</AuthMethodsContext.Provider>;
}

export const useAuthMethods = () => useContext(AuthMethodsContext);
