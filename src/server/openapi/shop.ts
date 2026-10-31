import type { PathsObject, SchemaObject } from "./types";

/** OpenAPI paths for protection products, cart and order requests (PRD §11.4). Money is integer paise. */

const str = { type: "string" };
const int = { type: "integer" };
const paise = { type: "integer", description: "Amount in paise (₹1 = 100)" };
const stock = { type: "string", enum: ["in_stock", "low_stock", "out_of_stock", "unknown"] };
const orderStatus = { type: "string", enum: ["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED", "DECLINED", "CANCELLED"] };
const idParam = (name: string, description?: string) => ({ name, in: "path" as const, required: true, schema: str, description });

const productCard: SchemaObject = {
  type: "object",
  properties: {
    id: str,
    slug: str,
    sku: str,
    nameEn: str,
    nameHi: { type: ["string", "null"] },
    summaryEn: { type: ["string", "null"] },
    pricePaise: paise,
    mrpPaise: { ...paise, type: ["integer", "null"] },
    featured: { type: "boolean" },
    universal: { type: "boolean", description: "Fits every device" },
    category: { type: "object", properties: { slug: str, nameEn: str, nameHi: { type: ["string", "null"] } } },
    type: { type: ["object", "null"], description: "Product type, e.g. HD+, Privacy, Anti-yellow", properties: { slug: str, nameEn: str, nameHi: { type: ["string", "null"] } } },
    imageId: { type: ["string", "null"], description: "Display via GET /api/v1/media/{imageId}" },
    stock,
  },
};

const cart: SchemaObject = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: str,
          productId: str,
          slug: str,
          nameEn: str,
          unitPricePaise: paise,
          quantity: int,
          lineTotalPaise: paise,
          device: { type: ["object", "null"], properties: { id: str, name: str } },
          stock,
          available: { type: "boolean" },
        },
      },
    },
    count: int,
    subtotalPaise: paise,
    hasUnavailable: { type: "boolean" },
    cartToken: { type: ["string", "null"], description: "Only on POST /cart/items for a new guest cart. Send it back as X-Cart-Token." },
  },
};

const cartTokenHeader = { name: "X-Cart-Token", in: "header" as const, schema: str, description: "Guest cart token for apps that don't keep cookies" };

export const paths: PathsObject = {
  "/api/v1/products": {
    get: {
      tags: ["Protection products"],
      summary: "List products",
      description: "Search, filter and sort ACTIVE products. `deviceModelId` returns products mapped to that model plus universal products.",
      security: "public",
      parameters: [
        { name: "q", in: "query", schema: str, description: "Search name, SKU, summary or category" },
        { name: "category", in: "query", schema: str, description: "Category slug" },
        { name: "type", in: "query", schema: str, description: "Product type slug, e.g. hd-plus, privacy, anti-yellow (see /api/v1/product-types)" },
        { name: "deviceModelId", in: "query", schema: str },
        { name: "sort", in: "query", schema: { type: "string", enum: ["featured", "newest", "price_asc", "price_desc"] } },
        { name: "inStock", in: "query", schema: { type: "boolean" } },
        { name: "page", in: "query", schema: int },
        { name: "pageSize", in: "query", schema: { type: "integer", maximum: 48 } },
      ],
      response: { type: "object", properties: { items: { type: "array", items: productCard }, total: int, page: int, pageSize: int, pages: int } },
    },
  },
  "/api/v1/products/{slug}": {
    get: {
      tags: ["Protection products"],
      summary: "Product detail",
      description: "Images, specifications, stock level and compatible models grouped by brand. 404 for unknown or inactive products.",
      security: "public",
      parameters: [idParam("slug")],
      response: {
        ...productCard,
        properties: {
          ...(productCard.properties as object),
          descriptionEn: { type: ["string", "null"] },
          specs: { type: "array", items: { type: "object", properties: { labelEn: str, labelHi: str, value: str } } },
          images: { type: "array", items: { type: "object", properties: { id: str, altEn: { type: ["string", "null"] } } } },
          compatibilityByBrand: { type: "array", items: { type: "object", properties: { brand: str, models: { type: "array", items: { type: "object", properties: { id: str, name: str } } } } } },
        },
      },
    },
  },
  "/api/v1/products/compatibility": {
    get: {
      tags: ["Protection products"],
      summary: "Check fit / products for a device",
      description: "With `productId`: `{ compatible, universal, note }`. Without: products that fit `deviceModelId`.",
      security: "public",
      parameters: [
        { name: "deviceModelId", in: "query", required: true, schema: str },
        { name: "productId", in: "query", schema: str },
      ],
    },
  },
  "/api/v1/product-categories": {
    get: {
      tags: ["Protection products"],
      summary: "Product categories",
      security: "public",
      response: { type: "array", items: { type: "object", properties: { id: str, slug: str, nameEn: str, nameHi: { type: ["string", "null"] }, productCount: int } } },
    },
  },
  "/api/v1/product-types": {
    get: {
      tags: ["Protection products"],
      summary: "Product types",
      description: "Types shoppers compare within a category (screen protectors: Normal clear, HD+, Privacy, Matte, UV curved, Ceramic…; cases: Normal silicone, Anti-yellow clear, MagSafe, Rugged…). `highlights` are 1–5 scores for comparison. Types without visible products are omitted.",
      security: "public",
      parameters: [{ name: "category", in: "query", schema: str, description: "Category slug, e.g. screen-protectors" }],
      response: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: str,
            slug: str,
            nameEn: str,
            nameHi: { type: ["string", "null"] },
            descriptionEn: { type: ["string", "null"] },
            highlights: { type: "object", description: "Trait → score 1–5 (clarity, privacy, antiGlare, toughness, protection, grip, slim, showsColour)" },
            imageMediaId: { type: ["string", "null"] },
            category: { type: "object", properties: { slug: str, nameEn: str } },
            count: int,
          },
        },
      },
    },
  },
  "/api/v1/cart": {
    get: {
      tags: ["Cart"],
      summary: "Get cart",
      description: "Signed-in users get their cart; a guest cart (cookie or X-Cart-Token) is merged into it on the first authenticated call.",
      security: "public",
      parameters: [cartTokenHeader],
      response: cart,
    },
  },
  "/api/v1/cart/items": {
    post: {
      tags: ["Cart"],
      summary: "Add to cart",
      description: "Adds or increments a line (max 10 per line, 30 lines). Rejects out-of-stock products and devices the product doesn't fit.",
      security: "public",
      parameters: [cartTokenHeader],
      requestBody: { schema: { type: "object", required: ["productId"], properties: { productId: str, deviceModelId: { type: ["string", "null"] }, quantity: { type: "integer", minimum: 1, maximum: 10 } } } },
      response: cart,
    },
  },
  "/api/v1/cart/items/{id}": {
    patch: {
      tags: ["Cart"],
      summary: "Change quantity",
      security: "public",
      parameters: [idParam("id"), cartTokenHeader],
      requestBody: { schema: { type: "object", required: ["quantity"], properties: { quantity: { type: "integer", minimum: 1, maximum: 10 } } } },
      response: cart,
    },
    delete: { tags: ["Cart"], summary: "Remove line", security: "public", parameters: [idParam("id"), cartTokenHeader], response: cart },
  },
  "/api/v1/product-requests": {
    post: {
      tags: ["Order requests"],
      summary: "Submit cart as an order request",
      description:
        "Creates a request, not a paid or confirmed order (FR-PROD-13). Prices are snapshotted; the cart is emptied. Requires `Idempotency-Key`; a retry returns the same reference with 200.",
      security: "bearer",
      parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 16, maxLength: 64 } }],
      requestBody: {
        schema: {
          type: "object",
          required: ["contactName", "contactPhone", "addressLine1", "city", "state", "pincode"],
          properties: { contactName: str, contactPhone: str, addressLine1: str, addressLine2: str, city: str, state: { type: "string", description: "Indian state or UT name" }, pincode: { type: "string", pattern: "^[1-9][0-9]{5}$" }, notes: str },
        },
      },
      response: { type: "object", properties: { reference: { type: "string", example: "TN-P-2610-00001" }, duplicate: { type: "boolean" } } },
    },
  },
  "/api/v1/account/product-requests": {
    get: {
      tags: ["Order requests"],
      summary: "My order requests",
      security: "bearer",
      response: { type: "array", items: { type: "object", properties: { reference: str, status: orderStatus, createdAt: str, subtotalPaise: paise, totalPaise: { type: ["integer", "null"] } } } },
    },
  },
  "/api/v1/account/product-requests/{reference}": {
    get: {
      tags: ["Order requests"],
      summary: "Track an order request",
      description: "Items, totals (shipping once confirmed), tracking info, customer-visible history and notes. Another customer's reference returns 404.",
      security: "bearer",
      parameters: [idParam("reference")],
    },
  },
  "/api/v1/account/product-requests/{reference}/cancel": {
    post: { tags: ["Order requests"], summary: "Cancel while SUBMITTED", security: "bearer", parameters: [idParam("reference")], response: { type: "object", properties: { status: orderStatus } } },
  },
  "/api/v1/admin/product-requests": {
    get: {
      tags: ["Admin · order requests"],
      summary: "Request queue",
      security: "staff",
      description: "Permission `product_request.manage`.",
      parameters: [
        { name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "ALL", "SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED", "DECLINED", "CANCELLED"] } },
        { name: "q", in: "query", schema: str },
        { name: "page", in: "query", schema: int },
      ],
    },
  },
  "/api/v1/admin/product-requests/{id}": {
    get: { tags: ["Admin · order requests"], summary: "Request detail", security: "staff", parameters: [idParam("id")] },
  },
  "/api/v1/admin/product-requests/{id}/review": {
    post: {
      tags: ["Admin · order requests"],
      summary: "Confirm or decline",
      description: "Confirm sets confirmed quantities (≤ requested), shipping and total; unit prices can't change. Decline needs a reason.",
      security: "staff",
      parameters: [idParam("id")],
      requestBody: {
        schema: {
          oneOf: [
            { type: "object", required: ["decision", "shippingPaise", "items"], properties: { decision: { const: "confirm" }, shippingPaise: paise, items: { type: "array", items: { type: "object", properties: { id: str, confirmedQuantity: int } } }, message: str } },
            { type: "object", required: ["decision", "reason"], properties: { decision: { const: "decline" }, reason: str } },
          ],
        },
      },
    },
  },
  "/api/v1/admin/product-requests/{id}/status": {
    post: {
      tags: ["Admin · order requests"],
      summary: "Advance status",
      description: "FULFILLING deducts stock atomically (409 if insufficient). SHIPPED needs `trackingInfo`; CANCELLED needs `reason`.",
      security: "staff",
      parameters: [idParam("id")],
      requestBody: { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["FULFILLING", "SHIPPED", "COMPLETED", "CANCELLED"] }, trackingInfo: str, reason: str } } },
    },
  },
  "/api/v1/admin/product-requests/{id}/notes": {
    post: {
      tags: ["Admin · order requests"],
      summary: "Add note",
      description: "Customer-visible notes appear on the customer's tracking page and notify them.",
      security: "staff",
      parameters: [idParam("id")],
      requestBody: { schema: { type: "object", required: ["body"], properties: { body: str, customerVisible: { type: "boolean" } } } },
    },
  },
};
