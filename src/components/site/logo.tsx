import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Brand mark + wordmark. The marks are transparent PNGs cut from the brand artwork,
 * so `tone="inverse"` (white) works on any dark surface.
 */
export function Logo({ className, tone = "default" }: { className?: string; tone?: "default" | "inverse" }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image src={tone === "inverse" ? "/brand/mark-white.png" : "/brand/mark-black.png"} alt="" width={226} height={271} className="h-8 w-auto shrink-0" />
      <span className="text-base font-extrabold tracking-tight uppercase sm:text-lg">Technentium</span>
    </span>
  );
}
