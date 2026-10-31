"use client";
import { useEffect, useState } from "react";
import type { DesignStyle } from "@/lib/customization/style";
import { cn } from "@/lib/cn";
import { DevicePreview } from "./device-preview";

type ShowcaseDesign = { slug: string; name: string; style: DesignStyle };
const FINISHES = ["gloss", "matte", "metallic", "leather", "carbon"];

/**
 * Hero preview that cycles through featured designs. Motion is skipped entirely when the visitor
 * prefers reduced motion (WCAG 2.3.3); the first design is then shown statically.
 */
export function HeroShowcase({ designs, label }: { designs: ShowcaseDesign[]; label: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (designs.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % designs.length), 3200);
    return () => clearInterval(id);
  }, [designs.length]);

  if (designs.length === 0) return null;
  const back = designs[(index + 1) % designs.length];

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm" aria-live="off">
      {/* Second device, tilted behind */}
      <div className="absolute top-8 right-0 w-[48%] rotate-[10deg] opacity-80 motion-safe:transition-all motion-safe:duration-700">
        <DevicePreview key={`b-${back.slug}`} kind="phone" style={back.style} finish="matte" coverage="full" seed={back.slug} label="" className="w-full" />
      </div>
      {designs.map((d, i) => (
        <div
          key={d.slug}
          className={cn(
            "absolute top-0 left-[6%] w-[58%] -rotate-[6deg] motion-safe:transition-all motion-safe:duration-700",
            i === index ? "opacity-100 motion-safe:translate-y-0" : "pointer-events-none opacity-0 motion-safe:translate-y-3",
          )}
          aria-hidden={i !== index}
        >
          <DevicePreview kind="phone" style={d.style} finish={FINISHES[i % FINISHES.length]} coverage="camera" seed={d.slug} label={i === index ? `${label}: ${d.name}` : ""} className="w-full drop-shadow-2xl" />
        </div>
      ))}
    </div>
  );
}
