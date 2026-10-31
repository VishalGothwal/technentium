import { describe, expect, it } from "vitest";
import { containsHtml, parseInline, plainText, safeHref } from "@/lib/content/inline";
import { headingId, readingMinutes, tableOfContents } from "@/lib/content/reading";
import { alignSpecs } from "@/lib/content/specs";
import { parseVideoUrl } from "@/lib/content/video";
import { blockSchema, createContentSchema, publishSchema, slugSchema, specGroupsSchema, translationSchema, type ContentBlock } from "@/lib/schemas/content";

describe("safe inline markup", () => {
  it("parses bold, italic and links into a token tree", () => {
    expect(parseInline("a **b** *c* [d](/en/repairs)")).toEqual([
      { type: "text", value: "a " },
      { type: "strong", children: [{ type: "text", value: "b" }] },
      { type: "text", value: " " },
      { type: "em", children: [{ type: "text", value: "c" }] },
      { type: "text", value: " " },
      { type: "link", href: "/en/repairs", external: false, children: [{ type: "text", value: "d" }] },
    ]);
  });

  it("marks http(s) links as external and keeps mailto/tel/#anchors", () => {
    const [link] = parseInline("[x](https://example.com/a?b=1)");
    expect(link).toMatchObject({ type: "link", external: true, href: "https://example.com/a?b=1" });
    expect(safeHref("mailto:hi@technentium.in")).toBe("mailto:hi@technentium.in");
    expect(safeHref("tel:+919876543210")).toBe("tel:+919876543210");
    expect(safeHref("#section-2")).toBe("#section-2");
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox",
    "//evil.example/x",
    "/\\evil.example",
    "file:///etc/passwd",
    "#bad\"onmouseover",
  ])("rejects unsafe href %j", (href) => {
    expect(safeHref(href)).toBeNull();
  });

  it("keeps the label of an unsafe link as plain text and never emits a link", () => {
    const nodes = parseInline("click [here](javascript:alert(1)) now");
    expect(nodes.some((n) => n.type === "link")).toBe(false);
    expect(plainText("click [here](javascript:alert(1)) now")).toContain("here");
  });

  it("treats HTML as literal text (no element nodes exist in the output)", () => {
    const nodes = parseInline("<script>alert(1)</script><img src=x onerror=alert(1)>");
    expect(nodes).toEqual([{ type: "text", value: "<script>alert(1)</script><img src=x onerror=alert(1)>" }]);
    expect(containsHtml("<b>bold</b>")).toBe(true);
    expect(containsHtml("5 < 6 and 7 > 3")).toBe(false);
  });
});

describe("block validation", () => {
  const ok = (b: unknown) => blockSchema.safeParse(b).success;

  it("accepts every supported block type", () => {
    const blocks: ContentBlock[] = [
      { type: "heading", level: 2, text: "Intro" },
      { type: "paragraph", text: "Hello **there**" },
      { type: "list", style: "bullet", items: ["a", "b"] },
      { type: "quote", text: "Quote", cite: "Someone" },
      { type: "image", mediaId: "abc123", alt: "A phone" },
      { type: "video", url: "https://youtu.be/abcdefghijk" },
      { type: "callout", tone: "warning", text: "Careful" },
      { type: "cta", kind: "repair" },
      { type: "related", items: [{ targetType: "CONTENT", targetId: "x1" }] },
    ];
    for (const b of blocks) expect(ok(b), b.type).toBe(true);
  });

  it("rejects HTML in any text field", () => {
    expect(ok({ type: "paragraph", text: "<script>alert(1)</script>" })).toBe(false);
    expect(ok({ type: "heading", level: 2, text: "<h1>Hi</h1>" })).toBe(false);
    expect(ok({ type: "list", style: "bullet", items: ["ok", "<img src=x onerror=1>"] })).toBe(false);
    expect(ok({ type: "callout", tone: "tip", text: "fine", title: "<b>x</b>" })).toBe(false);
  });

  it("rejects unknown block types, bad heading levels, images without alt, and non-YouTube/Vimeo videos", () => {
    expect(ok({ type: "html", text: "<p>x</p>" })).toBe(false);
    expect(ok({ type: "heading", level: 1, text: "x" })).toBe(false);
    expect(ok({ type: "image", mediaId: "abc", alt: "" })).toBe(false);
    expect(ok({ type: "video", url: "https://evil.example/video.mp4" })).toBe(false);
    expect(ok({ type: "video", url: "javascript:alert(1)" })).toBe(false);
  });

  it("rejects translations whose inline links use unsafe schemes", () => {
    const base = { title: "T", summary: "S" };
    expect(translationSchema.safeParse({ ...base, body: [{ type: "paragraph", text: "[x](/en/help)" }] }).success).toBe(true);
    const bad = translationSchema.safeParse({ ...base, body: [{ type: "paragraph", text: "[x](javascript:alert(1))" }] });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe("articles.validation.unsafeLink");
    expect(translationSchema.safeParse({ ...base, body: [{ type: "list", style: "number", items: ["[x](data:text/html,1)"] }] }).success).toBe(false);
  });

  it("validates slugs (format and reserved words) and requires a link for videos", () => {
    expect(slugSchema.safeParse("battery-care-tips").success).toBe(true);
    expect(slugSchema.parse("  Battery-Care  ")).toBe("battery-care");
    for (const s of ["a", "has space", "under_score", "-lead", "trail-", "double--dash", "topic", "new"]) expect(slugSchema.safeParse(s).success, s).toBe(false);
    const video = createContentSchema.safeParse({ type: "VIDEO", slug: "my-video", topic: "tips", translation: { title: "t", summary: "s", body: [] } });
    expect(video.success).toBe(false);
  });

  it("requires a future time when scheduling", () => {
    expect(publishSchema.safeParse({ locale: "en", action: "schedule", scheduledAt: new Date(Date.now() - 60_000).toISOString() }).success).toBe(false);
    expect(publishSchema.safeParse({ locale: "hi", action: "schedule", scheduledAt: new Date(Date.now() + 3_600_000).toISOString() }).success).toBe(true);
    expect(publishSchema.safeParse({ locale: "en", action: "publish" }).success).toBe(true);
  });
});

describe("reading helpers", () => {
  it("builds unique heading anchors, including Devanagari", () => {
    const used = new Map<string, number>();
    expect(headingId("Battery **care**", used)).toBe("battery-care");
    expect(headingId("Battery care", used)).toBe("battery-care-2");
    expect(headingId("बैटरी की देखभाल")).toBe("बैटरी-की-देखभाल");
  });

  it("derives a table of contents and reading time", () => {
    const blocks: ContentBlock[] = [
      { type: "heading", level: 2, text: "One" },
      { type: "paragraph", text: "word ".repeat(450) },
      { type: "heading", level: 3, text: "Two" },
    ];
    expect(tableOfContents(blocks).map((e) => [e.id, e.level])).toEqual([
      ["one", 2],
      ["two", 3],
    ]);
    expect(readingMinutes(blocks)).toBe(2);
    expect(readingMinutes([])).toBe(1);
  });
});

describe("video URLs", () => {
  it("produces privacy-friendly embeds", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=abcdefghijk")?.embedUrl).toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(parseVideoUrl("https://youtu.be/abcdefghijk")?.id).toBe("abcdefghijk");
    expect(parseVideoUrl("https://vimeo.com/123456789")?.embedUrl).toContain("dnt=1");
    expect(parseVideoUrl("https://example.com/watch?v=abc")).toBeNull();
    expect(parseVideoUrl("not a url")).toBeNull();
  });
});

describe("specifications (FR-SPEC-04)", () => {
  it("keeps unknown (null) distinct from 'No' and marks differences", () => {
    const a = [{ group: "camera", labelEn: "Cameras", items: [{ key: "telephoto", labelEn: "Telephoto", value: "No" }, { key: "main", labelEn: "Main", value: "48 MP" }] }];
    const b = [{ group: "camera", labelEn: "Cameras", items: [{ key: "telephoto", labelEn: "Telephoto", value: null }, { key: "main", labelEn: "Main", value: "48 mp" }] }];
    const [g] = alignSpecs([a, b]);
    const tele = g!.rows.find((r) => r.key === "telephoto")!;
    const main = g!.rows.find((r) => r.key === "main")!;
    expect(tele.values).toEqual(["No", null]);
    expect(tele.differs).toBe(true);
    expect(main.differs).toBe(false);
  });

  it("validates spec sheets and rejects HTML values", () => {
    expect(specGroupsSchema.safeParse([{ group: "display", labelEn: "Display", items: [{ key: "size", labelEn: "Size", value: null }] }]).success).toBe(true);
    expect(specGroupsSchema.safeParse([{ group: "display", labelEn: "Display", items: [{ key: "size", labelEn: "Size", value: "<b>6</b>" }] }]).success).toBe(false);
    expect(specGroupsSchema.safeParse([{ group: "Display Group", labelEn: "Display", items: [] }]).success).toBe(false);
  });
});
