import {
  BatteryCharging,
  BookOpen,
  Camera,
  Cpu,
  Earbuds,
  Laptop,
  LifeBuoy,
  Package,
  PackageSearch,
  Palette,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Watch,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Round icon button shared by the header actions (account, cart, menu). */
export const HEADER_ICON_BUTTON = "relative flex size-10 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-surface-muted";

/** Icon names are plain strings so server components can hand menu data to client components. */
const ICONS = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  watch: Watch,
  audio: Earbuds,
  repair: Wrench,
  shield: ShieldCheck,
  case: Smartphone,
  camera: Camera,
  charger: Zap,
  power: BatteryCharging,
  clean: Sparkles,
  package: Package,
  palette: Palette,
  specs: Cpu,
  articles: BookOpen,
  help: LifeBuoy,
  track: PackageSearch,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof ICONS;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className={className} strokeWidth={1.75} />;
}

const DEVICE_RULES: [RegExp, NavIconName][] = [
  [/phone|mobile/, "phone"],
  [/tablet|ipad/, "tablet"],
  [/laptop|macbook|notebook/, "laptop"],
  [/watch/, "watch"],
  [/audio|earbud|headphone/, "audio"],
];

const PRODUCT_RULES: [RegExp, NavIconName][] = [
  [/screen|glass|guard/, "shield"],
  [/camera|lens/, "camera"],
  [/earbud/, "audio"],
  [/case|cover/, "case"],
  [/charger|cable/, "charger"],
  [/power/, "power"],
  [/clean/, "clean"],
  [/laptop|sleeve/, "laptop"],
];

/** Picks an icon from keywords in a category slug, so new categories get a sensible icon without code changes. */
export const deviceIcon = (slug: string): NavIconName => DEVICE_RULES.find(([re]) => re.test(slug))?.[1] ?? "repair";
export const productIcon = (slug: string): NavIconName => PRODUCT_RULES.find(([re]) => re.test(slug))?.[1] ?? "package";
