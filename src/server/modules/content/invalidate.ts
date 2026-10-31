import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Expire cached public content after a CMS change. `{ expire: 0 }` so editors see a publish
 * immediately on the next request; works from both Server Actions and Route Handlers.
 * Outside a Next request (scripts, tests) there is no cache to expire, so errors are ignored.
 */
export function invalidateContent(...tags: string[]) {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // not inside a Next.js request scope
    }
  }
}
