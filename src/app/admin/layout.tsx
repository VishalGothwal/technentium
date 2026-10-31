import type { Metadata } from "next";
import "../globals.css";
import { fontVariables } from "@/lib/fonts";
import { I18nProvider } from "@/i18n/client";

export const metadata: Metadata = {
  title: { default: "Technentium Admin", template: "%s · Technentium Admin" },
  robots: { index: false, follow: false },
};

/**
 * Admin root layout. The staff console is English-only in this phase; shared components still
 * use the i18n provider so status labels come from one dictionary.
 */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="admin-console min-h-full">
        <I18nProvider locale="en">{children}</I18nProvider>
      </body>
    </html>
  );
}
