import type { PathsObject } from "./types";
import { bool, int, obj, pathId, str } from "./zod";

const tags = ["Media"];

/** Image uploads outside the repair flow (product, design, content images; customer artwork). */
export const paths: PathsObject = {
  "/api/v1/media": {
    post: {
      tags,
      summary: "Upload an image",
      description:
        "JPEG/PNG/WebP up to 10 MB, re-encoded to WebP with EXIF removed. `CUSTOM_ARTWORK` can be uploaded by any signed-in customer and stays private; other purposes are public and need the `media.upload` staff permission. Pass a `draftKey` to group artwork for a customization request before it is submitted.",
      security: "bearer",
      requestBody: {
        contentType: "multipart/form-data",
        schema: obj(
          {
            file: str("Image file", { format: "binary" }),
            purpose: { type: "string", enum: ["PRODUCT_IMAGE", "DESIGN_IMAGE", "CONTENT_IMAGE", "DEVICE_IMAGE", "CUSTOM_ARTWORK"] },
            draftKey: str(undefined, { maxLength: 64 }),
            altEn: str("Alt text (English)", { maxLength: 200 }),
            altHi: str("Alt text (Hindi)", { maxLength: 200 }),
          },
          ["file", "purpose"],
        ),
      },
      response: obj({ id: str(), width: int(), height: int(), purpose: str(), isPublic: bool() }),
    },
  },
  "/api/v1/media/{id}": {
    get: {
      tags,
      summary: "Fetch an image",
      description: "Public images are cacheable for a year. Private artwork is only returned to its owner and authorised staff (404 otherwise).",
      security: "public",
      parameters: [pathId()],
    },
    delete: {
      tags,
      summary: "Delete an image",
      description: "Your own artwork before it is attached to a request, or (staff) a public image no product uses.",
      security: "bearer",
      parameters: [pathId()],
      response: obj({ removed: bool() }),
    },
  },
};
