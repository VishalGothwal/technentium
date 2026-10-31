"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DevicePicker, type PickedDevice } from "@/components/device/device-picker";
import { useI18n } from "@/i18n/client";

/** "Shop for my device": picking a model opens the listing filtered to products that fit it. */
export function DeviceShopper() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [device, setDevice] = useState<PickedDevice | null>(null);
  const [pending, start] = useTransition();

  const choose = (d: PickedDevice | null) => {
    setDevice(d);
    if (d) start(() => router.push(`/${locale}/protection/products?device=${d.id}`));
  };

  return (
    <div aria-busy={pending}>
      <DevicePicker value={device} onChange={choose} />
      {pending && device && (
        <p className="mt-3 text-sm text-muted" role="status">
          {t("shop.seeProductsForDevice", { device: `${device.brand.name} ${device.name}` })}…
        </p>
      )}
    </div>
  );
}
