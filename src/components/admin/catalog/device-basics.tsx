"use client";
import { useState } from "react";
import { upsertModelAction } from "@/app/admin/actions";
import { useAction } from "@/components/admin/use-action";
import { ImageUpload } from "@/components/admin/content/media-upload";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/surface";

type Device = { id: string; brandId: string; name: string; releaseYear: number | null; active: boolean; popular: boolean; imageMediaId: string | null };

/** Device page: the one photo used across the site, plus name, year, live and popular. */
export function DeviceBasics({ device, usedOn }: { device: Device; usedOn: string[] }) {
  const { run, pending, error } = useAction();
  const [imageMediaId, setImageMediaId] = useState(device.imageMediaId);
  const [saved, setSaved] = useState(false);
  const save = (extra: Record<string, unknown>, form?: FormData) => {
    setSaved(false);
    const year = String(form?.get("releaseYear") ?? device.releaseYear ?? "").trim();
    run(
      () =>
        upsertModelAction({
          id: device.id,
          brandId: device.brandId,
          name: form ? form.get("name") : device.name,
          active: form ? form.get("active") === "on" : device.active,
          popular: form ? form.get("popular") === "on" : device.popular,
          releaseYear: year ? Number(year) : null,
          imageMediaId,
          ...extra,
        }),
      () => setSaved(true),
    );
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-2">
        <ImageUpload
          value={imageMediaId}
          onChange={(id) => {
            setImageMediaId(id);
            save({ imageMediaId: id });
          }}
          purpose="DEVICE_IMAGE"
          label="Product photo"
        />
        <p className="text-xs text-muted">Shown on: {usedOn.join(", ")}. Saved as soon as you upload or remove it.</p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save({}, new FormData(e.currentTarget));
        }}
      >
        {error && <Alert tone="danger">{error}</Alert>}
        {saved && !pending && <Alert tone="success">Saved.</Alert>}
        <Field label="Model name" hint="Renaming changes the device's web address." required>
          {(p) => <Input {...p} name="name" defaultValue={device.name} maxLength={80} />}
        </Field>
        <Field label="Release year">{(p) => <Input {...p} name="releaseYear" type="number" min={2000} max={2100} defaultValue={device.releaseYear ?? ""} />}</Field>
        <div className="flex flex-wrap gap-4">
          <Checkbox name="active" label="Live in booking" defaultChecked={device.active} />
          <Checkbox name="popular" label="Popular (shown first)" defaultChecked={device.popular} />
        </div>
        <Button type="submit" pending={pending}>
          Save
        </Button>
      </form>
    </div>
  );
}
