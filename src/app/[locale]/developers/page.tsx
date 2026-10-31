import type { Metadata } from "next";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/cn";
import { pageMetadata, SITE_URL } from "@/lib/seo";
import { API_SECTIONS } from "@/server/openapi";
import { ERROR_CODES, operationId } from "@/server/openapi/document";
import type { OperationObject, SchemaObject } from "@/server/openapi/types";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  return pageMetadata({ locale, path: "/developers", title: t("developers.title"), description: t("developers.intro"), noIndex: true });
}

const METHODS = ["get", "post", "put", "patch", "delete"] as const;
const METHOD_STYLE: Record<(typeof METHODS)[number], string> = {
  get: "bg-info-soft text-info",
  post: "bg-success-soft text-success",
  put: "bg-warning-soft text-warning",
  patch: "bg-warning-soft text-warning",
  delete: "bg-danger-soft text-danger",
};

/** Build a readable example value from a JSON schema (first enum value, example, or a typed placeholder). */
function example(schema: SchemaObject | undefined, depth = 0): unknown {
  if (!schema || depth > 5) return undefined;
  const s = schema as Record<string, unknown>;
  if (s.example !== undefined) return s.example;
  if (s.default !== undefined && s.default !== "" && !(Array.isArray(s.default) && s.default.length === 0)) return s.default;
  if (Array.isArray(s.enum)) return s.enum[0];
  if (s.const !== undefined) return s.const;
  for (const key of ["oneOf", "anyOf", "allOf"]) if (Array.isArray(s[key])) return example((s[key] as SchemaObject[]).find((x) => (x as { type?: string }).type !== "null"), depth + 1);
  switch (s.type) {
    case "object": {
      const props = (s.properties ?? {}) as Record<string, SchemaObject>;
      return Object.fromEntries(Object.entries(props).map(([k, v]) => [k, example(v, depth + 1)]));
    }
    case "array":
      return [example(s.items as SchemaObject, depth + 1)].filter((x) => x !== undefined);
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "string":
      return s.format === "date-time" ? "2026-10-29T10:00:00.000Z" : s.format === "email" ? "you@example.com" : s.format === "binary" ? "@photo.jpg" : "string";
    default:
      return undefined;
  }
}

function curlFor(method: string, path: string, op: OperationObject) {
  const url = `${SITE_URL}${path.replace(/\{(\w+)\}/g, (_, k: string) => `<${k}>`)}`;
  const lines = [`curl -X ${method.toUpperCase()} '${url}'`];
  if (op.security !== "public") lines.push(`  -H 'Authorization: Bearer $TOKEN'`);
  lines.push(`  -H 'Accept-Language: en'`);
  if (op.parameters?.some((p) => p.name === "Idempotency-Key")) lines.push(`  -H 'Idempotency-Key: $(uuidgen)'`);
  if (op.requestBody) {
    if (op.requestBody.contentType === "multipart/form-data") {
      const props = ((op.requestBody.schema as { properties?: Record<string, SchemaObject> }).properties ?? {}) as Record<string, SchemaObject>;
      for (const [k, v] of Object.entries(props)) lines.push(`  -F '${k}=${String(example(v))}'`);
    } else {
      lines.push(`  -H 'Content-Type: application/json'`);
      lines.push(`  -d '${JSON.stringify(example(op.requestBody.schema))}'`);
    }
  }
  return lines.join(" \\\n");
}

function AuthBadge({ security, t }: { security: OperationObject["security"]; t: (k: string) => string }) {
  const key = security ?? "public";
  const style = key === "public" ? "bg-surface-muted text-muted" : key === "staff" ? "bg-accent/10 text-accent" : "bg-primary-soft text-primary";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style)}>{t(`developers.auth.${key}`)}</span>;
}

export default async function DevelopersPage() {
  const { t } = await getT();
  const signIn = [
    `curl -i -X POST '${SITE_URL}/api/auth/sign-in/email' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '{"email":"you@example.com","password":"••••••••"}'`,
    ``,
    `# HTTP/1.1 200 OK`,
    `# set-auth-token: <TOKEN>`,
  ].join("\n");
  const otp = [
    `curl -X POST '${SITE_URL}/api/auth/phone-number/send-otp' \\`,
    `  -H 'Content-Type: application/json' -d '{"phoneNumber":"+919812345678"}'`,
    ``,
    `curl -i -X POST '${SITE_URL}/api/auth/phone-number/verify' \\`,
    `  -H 'Content-Type: application/json' -d '{"phoneNumber":"+919812345678","code":"123456"}'`,
  ].join("\n");
  const call = [`curl '${SITE_URL}/api/v1/account/activity' \\`, `  -H 'Authorization: Bearer $TOKEN' -H 'Accept-Language: hi'`].join("\n");

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:grid lg:grid-cols-[14rem_1fr] lg:gap-10">
      <aside className="hidden lg:block">
        <nav aria-label={t("developers.contents")} className="sticky top-24 space-y-1 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("developers.contents")}</p>
          {[
            ["start", t("developers.gettingStarted")],
            ["auth", t("developers.authTitle")],
            ["conventions", t("developers.conventions")],
            ["errors", t("developers.errorsTitle")],
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-md px-2 py-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
              {label}
            </a>
          ))}
          <div className="my-3 border-t border-border" />
          {API_SECTIONS.filter((s) => Object.keys(s.paths).length > 0).map((s) => (
            <a key={s.key} href={`#section-${s.key}`} className="block rounded-md px-2 py-1.5 text-muted hover:bg-surface-muted hover:text-foreground">
              {s.title}
            </a>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-12">
        <header id="start" className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("developers.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("developers.title")}</h1>
          <p className="max-w-2xl text-lg text-muted">{t("developers.intro")}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/api/v1/openapi.json" className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground hover:bg-primary-hover">
              {t("developers.downloadSpec")}
            </a>
            <code className="rounded-lg border border-border bg-surface px-3 py-2.5">{SITE_URL}/api/v1</code>
          </div>
        </header>

        <section id="auth" aria-labelledby="auth-h" className="space-y-4">
          <h2 id="auth-h" className="text-2xl font-semibold">
            {t("developers.authTitle")}
          </h2>
          <ol className="list-decimal space-y-2 pl-5 text-muted">
            <li>{t("developers.authStep1")}</li>
            <li>{t("developers.authStep2")}</li>
            <li>{t("developers.authStep3")}</li>
            <li>{t("developers.authStep4")}</li>
          </ol>
          <div className="grid gap-4 xl:grid-cols-2">
            <CodeBlock title={t("developers.emailSignIn")} code={signIn} />
            <CodeBlock title={t("developers.phoneSignIn")} code={otp} />
          </div>
          <CodeBlock title={t("developers.authenticatedCall")} code={call} />
        </section>

        <section id="conventions" aria-labelledby="conv-h" className="space-y-4">
          <h2 id="conv-h" className="text-2xl font-semibold">
            {t("developers.conventions")}
          </h2>
          <dl className="grid gap-3 sm:grid-cols-2">
            {["envelope", "money", "language", "idempotency", "pagination", "uploads"].map((k) => (
              <div key={k} className="rounded-xl border border-border bg-surface p-4">
                <dt className="font-medium">{t(`developers.conv.${k}.title`)}</dt>
                <dd className="mt-1 text-sm text-muted">{t(`developers.conv.${k}.body`)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="errors" aria-labelledby="err-h" className="space-y-4">
          <h2 id="err-h" className="text-2xl font-semibold">
            {t("developers.errorsTitle")}
          </h2>
          <pre className="overflow-x-auto rounded-xl bg-[#0b1220] p-4 text-sm text-slate-100">
            {`{ "error": { "code": "VALIDATION", "messageKey": "validation.required",\n             "message": "This field is required.", "fields": { "name": "…" } } }`}
          </pre>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">HTTP</th>
                  <th scope="col" className="px-4 py-2 font-medium">code</th>
                  <th scope="col" className="px-4 py-2 font-medium">{t("developers.meaning")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ERROR_CODES.map((e) => (
                  <tr key={e.code}>
                    <td className="px-4 py-2 font-mono">{e.status}</td>
                    <td className="px-4 py-2 font-mono">{e.code}</td>
                    <td className="px-4 py-2 text-muted">{e.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {API_SECTIONS.filter((s) => Object.keys(s.paths).length > 0).map((section) => (
          <section key={section.key} id={`section-${section.key}`} aria-labelledby={`h-${section.key}`} className="space-y-4">
            <h2 id={`h-${section.key}`} className="text-2xl font-semibold">
              {section.title}
            </h2>
            {Object.entries(section.paths).flatMap(([path, item]) =>
              METHODS.filter((m) => item[m]).map((m) => {
                const op = item[m]!;
                return (
                  <details key={`${m}${path}`} id={operationId(m, path)} className="group rounded-xl border border-border bg-surface open:shadow-sm">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
                      <span className={cn("w-16 rounded-md px-2 py-0.5 text-center font-mono text-xs font-bold uppercase", METHOD_STYLE[m])}>{m}</span>
                      <code className="break-all font-mono text-sm">{path}</code>
                      <span className="text-sm text-muted">— {op.summary}</span>
                      <span className="ml-auto">
                        <AuthBadge security={op.security} t={t} />
                      </span>
                    </summary>
                    <div className="space-y-4 border-t border-border p-4">
                      {op.description && <p className="text-sm text-muted">{op.description}</p>}
                      {op.parameters && op.parameters.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-muted">
                              <tr>
                                <th scope="col" className="py-1 pr-4 font-medium">{t("developers.parameter")}</th>
                                <th scope="col" className="py-1 pr-4 font-medium">{t("developers.in")}</th>
                                <th scope="col" className="py-1 font-medium">{t("developers.description")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {op.parameters.map((p) => (
                                <tr key={p.name} className="border-t border-border">
                                  <td className="py-1.5 pr-4 font-mono">
                                    {p.name}
                                    {p.required && <span className="text-danger">*</span>}
                                  </td>
                                  <td className="py-1.5 pr-4 text-muted">{p.in}</td>
                                  <td className="py-1.5 text-muted">{p.description ?? ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="grid gap-4 xl:grid-cols-2">
                        <CodeBlock title={t("developers.example")} code={curlFor(m, path, op)} />
                        {op.response && <CodeBlock title={t("developers.response")} code={JSON.stringify(path.startsWith("/api/auth/") ? example(op.response) : { data: example(op.response) }, null, 2)} />}
                      </div>
                    </div>
                  </details>
                );
              }),
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-[#1e293b] bg-[#0b1220]">
      <figcaption className="border-b border-[#1e293b] px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</figcaption>
      <pre className="max-h-96 overflow-auto p-4 text-[13px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
