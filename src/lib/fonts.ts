import { Noto_Sans_Devanagari, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";

/** Geometric body face; pairs with the heavy, angular brand mark. */
export const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans-latin",
  display: "swap",
});
export const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});
/** Display face for headings and numbers (Latin only — Hindi falls back to Devanagari). */
export const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display-latin",
  display: "swap",
  weight: ["500", "600", "700"],
});

/** Font CSS variables for a root `<html>` element. */
export const fontVariables = `${sans.variable} ${devanagari.variable} ${display.variable}`;
