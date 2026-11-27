import { describe, expect, it } from "vitest";
import { productListQuerySchema } from "@/lib/schemas/shop";

describe("product list query", () => {
  it("reads inStock from query-string text and from the web page's boolean", () => {
    const inStock = (v: unknown) => productListQuerySchema.parse({ inStock: v }).inStock;
    expect(inStock("false")).toBe(false);
    expect(inStock("0")).toBe(false);
    expect(inStock("true")).toBe(true);
    expect(inStock(true)).toBe(true);
    expect(inStock(undefined)).toBe(false);
  });
});
