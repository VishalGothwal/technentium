"use client";
import { useEffect } from "react";
import "./globals.css";
import { fontVariables } from "@/lib/fonts";

/** Last-resort error page when a root layout itself fails. It replaces the layout, so it renders its own document. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full items-center justify-center px-4">
        <title>Something went wrong · Technentium</title>
        <main className="flex max-w-md flex-col items-center py-20 text-center" role="alert">
          <p className="text-sm font-extrabold tracking-tight uppercase">Technentium</p>
          <h1 className="mt-6 text-3xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-lg">कुछ गलत हो गया</p>
          <p className="mt-4 text-muted">Please try again. / कृपया फिर कोशिश करें।</p>
          <button
            type="button"
            onClick={() => retry()}
            className="mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Try again / फिर कोशिश करें
          </button>
        </main>
      </body>
    </html>
  );
}
