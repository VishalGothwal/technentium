"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_STYLE, type DesignStyle, type DeviceKind, type TextFont, type TextPosition } from "@/lib/customization/style";
import { aspectOf, KIND_DEFAULTS, type Device3DSpec } from "@/lib/device-3d";
import { DevicePreview } from "@/components/customization/device-preview";
import type { DeviceScene, SceneModel } from "./device-3d-scene";

export type Device3DProps = {
  kind: DeviceKind;
  /** Which 3D body to draw (Device3DModel or the device's frame family). */
  spec: Device3DSpec;
  view?: "back" | "front";
  /** Skin; omit to show the bare device (repair pages). */
  style?: DesignStyle | null;
  finish?: string | null;
  coverage?: string | null;
  text?: { value: string; font: TextFont; position: TextPosition; color: string } | null;
  artwork?: { href: string; scale: number; x: number; y: number } | null;
  seed?: string;
  label: string;
  className?: string;
  /** Drag / arrow keys to rotate (default true). */
  interactive?: boolean;
};

/**
 * 3D device viewer. Renders the 2D `DevicePreview` straight away (server HTML, no-WebGL fallback), then loads
 * three.js on demand and swaps in a rotatable 3D body whose faces carry that same preview as textures.
 */
export function Device3D({ kind, spec, view = "back", style, finish, coverage, text, artwork, seed, label, className, interactive = true }: Device3DProps) {
  const mount = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DeviceScene | null>(null);
  const [scene, setScene] = useState<DeviceScene | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const artData = useDataUrl(artwork?.href ?? null);

  const skinned = !!style;
  const bare: DesignStyle = { ...DEFAULT_STYLE, pattern: "solid", palette: [spec.params.backColor ?? KIND_DEFAULTS[kind].backColor, spec.params.backColor ?? KIND_DEFAULTS[kind].backColor] };
  const faceStyle = style ?? bare;
  const cov = skinned ? coverage : "back";
  const fin = skinned ? finish : null;
  const art = artwork && artData ? { ...artwork, href: artData } : null;
  const aspect = aspectOf(spec.params);

  // 1. Create the scene once (three.js is a separate chunk, fetched only when a viewer mounts).
  useEffect(() => {
    let cancelled = false;
    const el = mount.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./device-3d-scene")
      .then(({ createDeviceScene }) => {
        if (cancelled) return;
        try {
          const s = createDeviceScene(el, { reducedMotion, interactive });
          sceneRef.current = s;
          setScene(s);
        } catch (e) {
          console.warn("WebGL unavailable; showing the 2D preview.", e);
          setFailed(true);
        }
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [interactive]);

  // 2. Body: rebuilt when the device, its 3D model or the surface options change.
  const edgeColor = skinned && (cov === "sides" || cov === "full") ? faceStyle.palette[0] : null;
  const modelKey = JSON.stringify([kind, spec, fin, cov, edgeColor, skinned]);
  useEffect(() => {
    if (!scene) return;
    const m: SceneModel = { kind, frame: spec.frame, params: spec.params, glbUrl: spec.glbUrl, finish: fin, coverage: cov, edgeColor, skinned };
    scene.setModel(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- modelKey captures every input
  }, [scene, modelKey]);

  // 3. Faces: re-capture the hidden SVG previews whenever the design changes.
  const faceKey = JSON.stringify([modelKey, faceStyle, text, art?.href, art?.scale, art?.x, art?.y, seed]);
  useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    (async () => {
      for (const [side, ref] of [
        ["back", backRef],
        ["front", frontRef],
      ] as const) {
        const svg = ref.current?.querySelector("svg");
        if (!svg) continue;
        const img = await svgToImage(svg, scene.textureSize());
        if (cancelled || !img) return;
        scene.drawTexture(side, img);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [scene, faceKey]);

  useEffect(() => {
    scene?.setView(view);
  }, [scene, view]);

  const preview = (v: "back" | "front", cls: string) => (
    <DevicePreview kind={kind} frame={spec.frame} aspect={aspect} view={v} style={faceStyle} finish={fin} coverage={cov} text={text} artwork={v === "back" ? art : null} seed={seed} label="" className={cls} />
  );

  return (
    <div
      role="img"
      aria-label={label}
      tabIndex={interactive && ready ? 0 : undefined}
      onKeyDown={(e) => {
        if (!interactive || !scene) return;
        const step = { ArrowLeft: [-0.3, 0], ArrowRight: [0.3, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
        if (step) {
          e.preventDefault();
          scene.nudge(step[0], step[1]);
        }
      }}
      className={cn("relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]", className)}
    >
      <div ref={mount} className={cn("absolute inset-0 transition-opacity duration-500", ready && !failed ? "opacity-100" : "opacity-0")} />
      {(!ready || failed) && (
        <div className="absolute inset-0 flex items-center justify-center p-[6%]">
          {/* 2D drawing: first paint, and the fallback without WebGL. */}
          <DevicePreview kind={kind} frame={spec.frame} aspect={aspect} view={view} style={faceStyle} finish={fin} coverage={cov} text={text} artwork={view === "back" && artwork ? artwork : null} seed={seed} label="" className="h-full max-w-full" />
        </div>
      )}
      {/* Texture sources: rendered off-screen and rasterised into the 3D faces. */}
      <div aria-hidden className="pointer-events-none fixed top-0 -left-[10000px] h-px w-px overflow-hidden">
        <div ref={backRef}>{preview("back", "")}</div>
        <div ref={frontRef}>{preview("front", "")}</div>
      </div>
    </div>
  );
}

/** Rasterise an inline SVG (CSS variables in font stacks are dropped: an SVG image can't read the page's CSS). */
async function svgToImage(svg: SVGSVGElement, size: { width: number; height: number }): Promise<HTMLImageElement | null> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(size.width));
  clone.setAttribute("height", String(size.height));
  clone.setAttribute("preserveAspectRatio", "none");
  const markup = new XMLSerializer().serializeToString(clone).replace(/var\(--[\w-]+\),?\s*/g, "");
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    // Revoke after the image has been drawn by the caller's next tick.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Artwork inside an SVG image must be inline: fetch it once into a data URL (null while loading or on failure). */
function useDataUrl(href: string | null) {
  const [state, setState] = useState<{ href: string; data: string | null } | null>(null);
  useEffect(() => {
    if (!href || href.startsWith("data:")) return;
    let cancelled = false;
    fetch(href)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
          }),
      )
      .then((data) => !cancelled && setState({ href, data }))
      .catch(() => !cancelled && setState({ href, data: null }));
    return () => {
      cancelled = true;
    };
  }, [href]);
  if (!href) return null;
  if (href.startsWith("data:")) return href;
  return state?.href === href ? state.data : null;
}
