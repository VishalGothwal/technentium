import "server-only";
import { paths as account } from "./account";
import { paths as content } from "./content";
import { paths as media } from "./media";
import { paths as repair } from "./repair";
import { paths as shop } from "./shop";
import { paths as studio } from "./studio";
import type { PathsObject } from "./types";

export const API_SECTIONS: { key: string; title: string; paths: PathsObject }[] = [
  { key: "account", title: "Authentication & account", paths: account },
  { key: "repair", title: "Devices & repairs", paths: repair },
  { key: "shop", title: "Protection products & orders", paths: shop },
  { key: "studio", title: "Customization", paths: studio },
  { key: "content", title: "Articles, videos & specifications", paths: content },
  { key: "media", title: "Media & uploads", paths: media },
];
