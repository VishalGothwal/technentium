import { mediaUrl } from "@/lib/media";
import { readConfig } from "@/lib/customization/config";
import { DEFAULT_STYLE } from "@/lib/customization/style";
import { DevicePreview } from "./device-preview";

/** Re-render a saved request exactly as it was previewed (FR-CUSTOM-05). */
export function ConfigPreview({ configuration, label, className }: { configuration: unknown; label: string; className?: string }) {
  const c = readConfig(configuration);
  if (!c) return <DevicePreview kind="phone" style={DEFAULT_STYLE} label={label} className={className} />;
  return (
    <DevicePreview
      kind={c.device.kind}
      frame={c.device.frame}
      style={c.style}
      finish={c.finish.slug}
      coverage={c.coverage.slug}
      text={c.text}
      artwork={c.artwork ? { href: mediaUrl(c.artwork.mediaId), scale: c.artwork.scale, x: c.artwork.x, y: c.artwork.y } : null}
      seed={c.design?.slug}
      label={label}
      className={className}
    />
  );
}
