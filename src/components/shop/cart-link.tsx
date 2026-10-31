import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getT } from "@/i18n/server";
import { getActor } from "@/server/auth/session";
import { cartCount } from "@/server/modules/shop/cart.service";
import { cartIdentity } from "@/server/modules/shop/cart-session";
import { HEADER_ICON_BUTTON } from "@/components/site/nav-icons";

/** Header cart icon with item count. Reads the session and cart cookie, so render inside <Suspense>. */
export async function CartLink() {
  const { t, locale } = await getT();
  const count = await cartCount(await cartIdentity(await getActor()));
  return (
    <Link href={`/${locale}/protection/cart`} aria-label={t("cart.label", { count })} className={HEADER_ICON_BUTTON}>
      <ShoppingBag aria-hidden className="size-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute top-0 right-0 flex h-4.5 min-w-4.5 ring-2 ring-surface items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
