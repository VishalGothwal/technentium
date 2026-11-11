"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { cn } from "@/lib/cn";
import { deviceKindFor } from "@/lib/customization/style";
import { BODY_MATERIALS, KIND_DEFAULTS, MAX_GLB_BYTES, type Device3DParams } from "@/lib/device-3d";
import { FRAME_FAMILIES, FRAME_KEYS, frameFor } from "@/lib/device-frames";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/surface";
import { useAction } from "@/components/admin/use-action";
import { DevicePicker } from "@/components/device/device-picker";
import { DeviceViewer } from "@/components/device/device-viewer";
import { assignDevicesAction, deleteDevice3dAction, finishGlbUploadAction, generateDefaultsAction, removeGlbAction, saveDevice3dAction, startGlbUploadAction } from "./actions";

export type Model3dValues = { slug: string; name: string; frame: string; params: Device3DParams; notes: string; active: boolean };
type Device = { id: string; name: string; kind: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80);
const SAMPLE_SKIN = { pattern: "waves" as const, palette: ["#0b3c49", "#2ec4b6", "#cbf3f0"], density: 5, angle: 45 };

export function Model3dForm({ id, initial, file, devices }: { id: string | null; initial: Model3dValues; file: { url: string; sizeBytes: number } | null; devices: Device[] }) {
  const router = useRouter();
  const { run, pending, error, fields } = useAction();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [sample, setSample] = useState(false);
  const kind = frameFor(v.frame).kind;
  const d = KIND_DEFAULTS[kind];

  const set = (patch: Partial<Model3dValues>) => {
    setSaved(false);
    setV((x) => ({ ...x, ...patch }));
  };
  const setParam = <K extends keyof Device3DParams>(k: K, value: Device3DParams[K] | undefined) => {
    const params = { ...v.params };
    if (value === undefined) delete params[k];
    else params[k] = value;
    set({ params });
  };

  const save = () =>
    run(
      () => saveDevice3dAction(id, v),
      (data) => {
        setSaved(true);
        const newId = (data as { id: string } | null)?.id;
        if (!id && newId) router.replace(`/admin/models-3d/${newId}`);
      },
    );

  const slider = (k: "thickness" | "bumpHeight" | "cornerRadius" | "glbScale" | "glbRotateX" | "glbRotateY" | "glbRotateZ", label: string, min: number, max: number, step: number, fallback: number) => (
    <label className="block text-sm">
      <span className="flex justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted">
          {(v.params[k] ?? fallback).toFixed(step < 1 ? 3 : 0)}
          {v.params[k] !== undefined && (
            <button type="button" className="ml-2 text-primary hover:underline" onClick={() => setParam(k, undefined)}>
              reset
            </button>
          )}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={v.params[k] ?? fallback} onChange={(e) => setParam(k, Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" />
    </label>
  );
  const colour = (k: "bodyColor" | "backColor", label: string, fallback: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="color" value={v.params[k] ?? fallback} onChange={(e) => setParam(k, e.target.value)} className="size-9 cursor-pointer rounded border border-border bg-transparent" />
      {label}
    </label>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-5">
        <Card>
          <CardBody className="space-y-5">
            {error && <Alert tone="danger">{error}</Alert>}
            {saved && <Alert tone="success">Saved. Previews use it straight away.</Alert>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={fields.name} required>
                {(p) => <Input {...p} value={v.name} onChange={(e) => set({ name: e.target.value, ...(id ? {} : { slug: slugify(e.target.value) }) })} />}
              </Field>
              <Field label="Slug" error={fields.slug} required>
                {(p) => <Input {...p} value={v.slug} onChange={(e) => set({ slug: e.target.value })} />}
              </Field>
              <Field label="Camera layout (base shape)" hint="The generated body, camera bump and skin layout follow this layout." error={fields.frame}>
                {(p) => (
                  <Select {...p} value={v.frame} onChange={(e) => set({ frame: e.target.value })}>
                    {FRAME_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {FRAME_FAMILIES[k].label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Frame material">
                {(p) => (
                  <Select {...p} value={v.params.bodyMaterial ?? d.bodyMaterial} onChange={(e) => setParam("bodyMaterial", e.target.value as Device3DParams["bodyMaterial"])}>
                    {BODY_MATERIALS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["heightMm", "widthMm", "thicknessMm"] as const).map((k) => (
                <Field key={k} label={{ heightMm: "Height (mm)", widthMm: "Width (mm)", thicknessMm: "Thickness (mm)" }[k]} hint={k === "heightMm" ? "From the spec sheet; sets the real proportions." : undefined}>
                  {(p) => <Input {...p} inputMode="decimal" value={v.params[k] ?? ""} onChange={(e) => setParam(k, e.target.value.trim() ? Number(e.target.value) || undefined : undefined)} />}
                </Field>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {!(v.params.thicknessMm && v.params.widthMm) && slider("thickness", "Thickness (× width)", 0.02, 0.3, 0.005, d.thickness)}
              {slider("bumpHeight", "Camera bump (× width)", 0, 0.12, 0.002, d.bumpHeight)}
              {slider("cornerRadius", "Corner radius", 0, 120, 1, frameFor(v.frame).r)}
            </div>
            <div className="flex flex-wrap gap-6">
              {colour("bodyColor", "Frame colour", d.bodyColor)}
              {colour("backColor", "Back colour (no skin)", d.backColor)}
            </div>
            <Field label="Notes" error={fields.notes}>
              {(p) => <Textarea {...p} className="min-h-16" maxLength={500} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />}
            </Field>
            <Checkbox checked={v.active} onChange={(e) => set({ active: e.target.checked })} label="Active (off: its devices use the automatic body)" />
            <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
              {id ? <DeleteButton id={id} /> : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => router.push("/admin/models-3d")}>
                  Back
                </Button>
                <Button type="button" pending={pending} onClick={save}>
                  {id ? "Save changes" : "Create 3D model"}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {id && <GlbPanel id={id} file={file} />}
        {id && file && (
          <Card>
            <CardHeader title="Uploaded file adjustments" description="Use these if the file appears sideways or too small. The viewer centres the model automatically." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              {slider("glbScale", "Scale", 0.1, 3, 0.01, 1)}
              {slider("glbRotateX", "Rotate X (°)", -180, 180, 1, 0)}
              {slider("glbRotateY", "Rotate Y (°)", -180, 180, 1, 0)}
              {slider("glbRotateZ", "Rotate Z (°)", -180, 180, 1, 0)}
              <p className="text-xs text-muted sm:col-span-2">Save changes to keep these.</p>
            </CardBody>
          </Card>
        )}
        {id && <DevicesPanel id={id} devices={devices} />}
      </div>

      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader title="Live preview" action={<Checkbox checked={sample} onChange={(e) => setSample(e.target.checked)} label="Sample skin" />} />
        <div className="h-[30rem] bg-[radial-gradient(circle_at_50%_35%,#2a2352_0%,#0b0c14_75%)]">
          <DeviceViewer
            kind={kind}
            spec={{ frame: v.frame, params: v.params, glbUrl: file?.url ?? null }}
            style={sample ? SAMPLE_SKIN : null}
            finish={sample ? "gloss" : null}
            coverage={sample ? "camera" : null}
            label={`3D preview of ${v.name || "the model"}`}
            initialView="back"
            dark
            className="h-full w-full"
          />
        </div>
      </Card>
    </div>
  );
}

/** Check, upload (signed bucket URL or through the app) and attach one .glb file. Throws a readable message. */
async function uploadGlbFile(id: string, f: File, t: (k: string) => string, status: (s: string) => void) {
  if (!f.name.toLowerCase().endsWith(".glb")) throw new Error("Choose a .glb file (glTF binary). Convert .gltf/.fbx/.obj files to .glb first, e.g. in Blender: File → Export → glTF 2.0 (.glb).");
  if (f.size > MAX_GLB_BYTES) throw new Error(`The file is larger than ${MAX_GLB_BYTES / 1048576} MB. Compress textures or decimate the mesh.`);
  status("Preparing…");
  const start = await startGlbUploadAction(id, f.size);
  if (!start.ok) throw new Error(t(start.messageKey));
  status("Uploading…");
  if (start.data.mode === "presigned") {
    const put = await fetch(start.data.url, { method: "PUT", body: f, headers: { "Content-Type": start.data.contentType } });
    if (!put.ok) throw new Error(`Storage refused the upload (${put.status}). Check the bucket's CORS allows PUT from this site.`);
    status("Checking file…");
    const done = await finishGlbUploadAction(id, start.data.key);
    if (!done.ok) throw new Error(t(done.messageKey));
  } else {
    const put = await fetch(`/api/v1/admin/device-3d/${id}/file?key=${encodeURIComponent(start.data.key)}`, { method: "PUT", body: f, headers: { "Content-Type": "model/gltf-binary" } });
    if (!put.ok) throw new Error(((await put.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? `Upload failed (${put.status})`);
  }
}

/** Several .glb files at once, matched to 3D models by file name: "<model slug>.glb", e.g. "apple-iphone-16-pro.glb". */
export function BulkGlbUpload({ slugs }: { slugs: Record<string, string> }) {
  const { t } = useI18n();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function run(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const out: string[] = [];
    for (const f of Array.from(files)) {
      const slug = f.name.toLowerCase().replace(/\.glb$/, "");
      const id = slugs[slug];
      if (!id) {
        out.push(`✗ ${f.name}: no 3D model with slug “${slug}”`);
        continue;
      }
      try {
        await uploadGlbFile(id, f, t, () => {});
        out.push(`✓ ${f.name}`);
      } catch (e) {
        out.push(`✗ ${f.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
      setLog([...out]);
    }
    setLog(out);
    setBusy(false);
  }
  return (
    <Card className="mb-6">
      <CardHeader title="Bulk upload .glb" description="Pick many files; each is matched by name to a model slug (shown under each name below), e.g. apple-iphone-16-pro.glb." />
      <CardBody className="space-y-3">
        <label className={cn("inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover has-[:focus-visible]:outline-2", busy && "pointer-events-none opacity-60")}>
          {busy ? "Uploading…" : "Choose .glb files"}
          <input type="file" multiple accept=".glb,model/gltf-binary" className="sr-only" onChange={(e) => void run(e.target.files)} />
        </label>
        {log.length > 0 && (
          <ul className="max-h-60 overflow-y-auto font-mono text-xs">
            {log.map((l, i) => (
              <li key={i} className={l.startsWith("✗") ? "text-danger" : ""}>
                {l}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function GlbPanel({ id, file }: { id: string; file: { url: string; sizeBytes: number } | null }) {
  const { run, pending, error } = useAction();
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function upload(f: File | undefined) {
    if (!f) return;
    setUploadError(null);
    try {
      await uploadGlbFile(id, f, t, setBusy);
      location.reload();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="3D file (.glb)"
        description="Optional. Upload a real model to replace the generated body. Facing +Z with Y up works best. Name the back-panel mesh or material “skin” or “back” and the display “screen” so customer designs are applied to them (UVs 0–1 across each face)."
      />
      <CardBody className="space-y-3">
        {(error || uploadError) && <Alert tone="danger">{uploadError ?? error}</Alert>}
        <p className="text-sm">{file ? `Uploaded: ${(file.sizeBytes / 1048576).toFixed(2)} MB` : "No file — using the generated body."}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className={cn("inline-flex cursor-pointer items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover has-[:focus-visible]:outline-2", busy && "pointer-events-none opacity-60")}>
            {file ? "Replace file" : "Upload .glb"}
            <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
          </label>
          {file && (
            <Button type="button" variant="ghost" pending={pending} onClick={() => run(() => removeGlbAction(id))}>
              Remove file
            </Button>
          )}
          {busy && <span className="text-sm text-muted">{busy}</span>}
        </div>
      </CardBody>
    </Card>
  );
}

function DevicesPanel({ id, devices }: { id: string; devices: Device[] }) {
  const { run, pending, error } = useAction();
  return (
    <Card>
      <CardHeader title={`Devices using this model (${devices.length})`} description="Pick a device to link it. A device can use one 3D model; linking it here moves it from its previous model." />
      <CardBody className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <DevicePicker value={null} onChange={(d) => d && run(() => assignDevicesAction(id, [d.id], []))} categorySlugs={["phone", "tablet", "laptop"]} />
        {devices.length > 0 && (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border text-sm">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>
                  {d.name} <span className="text-xs text-muted">{deviceKindFor(d.kind)}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => assignDevicesAction(id, [], [d.id]))}>
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function DeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <span>
      <Button
        type="button"
        variant="ghost"
        pending={pending}
        onClick={() => confirm("Delete this 3D model? Its devices go back to the automatic body.") && run(() => deleteDevice3dAction(id), () => router.replace("/admin/models-3d"))}
      >
        Delete
      </Button>
      {error && <span className="ml-2 text-xs text-danger">{error}</span>}
    </span>
  );
}

export function GenerateDefaultsButton() {
  const { run, pending, error } = useAction();
  const [result, setResult] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {(error || result) && <span className={cn("text-xs", error ? "text-danger" : "text-muted")}>{error ?? result}</span>}
      <Button
        type="button"
        variant="secondary"
        pending={pending}
        onClick={() =>
          run(
            () => generateDefaultsAction(),
            (data) => {
              const r = data as { created: number; updated: number; linked: number; withSize: number; total: number };
              setResult(`${r.created} created, ${r.updated} updated, ${r.linked} devices linked; real size known for ${r.withSize} of ${r.total}.`);
            },
          )
        }
      >
        Generate for all devices
      </Button>
    </span>
  );
}
