import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { removeMedia } from "@/server/modules/media/media.service";
import { hit } from "@/server/rate-limit";
import { owner } from "../support/fixtures";

describe("rate limiter", () => {
  it("lets exactly `max` of many parallel requests through", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 12 }, () => hit(key, 60, 5)));
    expect(results.filter(Boolean)).toHaveLength(5);
  });

  it("starts a new window once the old one has passed", async () => {
    const key = `test:${randomUUID()}`;
    for (let i = 0; i < 3; i++) await hit(key, 60, 3);
    expect(await hit(key, 60, 3)).toBe(false);
    await db.rateLimit.update({ where: { key: `app:${key}` }, data: { lastRequest: BigInt(Date.now() - 61_000) } });
    expect(await hit(key, 60, 3)).toBe(true);
  });
});

describe("public media delete", () => {
  it("refuses to delete an image still used by a device model", async () => {
    const actor = await owner();
    const media = await db.mediaAsset.create({
      data: { storageKey: `media/device_image/${randomUUID()}.webp`, mime: "image/webp", sizeBytes: 1, purpose: "DEVICE_IMAGE", isPublic: true, uploadedById: actor.userId },
    });
    const model = await db.deviceModel.findFirstOrThrow({ where: { slug: "iphone-13" }, select: { id: true, imageMediaId: true } });
    await db.deviceModel.update({ where: { id: model.id }, data: { imageMediaId: media.id } });
    try {
      await expect(removeMedia(actor, media.id)).rejects.toMatchObject({ code: "CONFLICT" });
      expect(await db.mediaAsset.findUnique({ where: { id: media.id } })).not.toBeNull();
    } finally {
      await db.deviceModel.update({ where: { id: model.id }, data: { imageMediaId: model.imageMediaId } });
      await db.mediaAsset.delete({ where: { id: media.id } });
    }
  });
});
