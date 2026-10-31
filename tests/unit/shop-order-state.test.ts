import { describe, expect, it } from "vitest";
import {
  confirmedTotal,
  discountPercent,
  findOrderRule,
  ORDER_RULES,
  orderStepIndex,
  staffTargets,
  stockLevel,
  subtotalOf,
  TERMINAL_ORDER_STATUSES,
} from "@/server/modules/shop/order-state";
import { productRequestSchema, productSchema } from "@/lib/schemas/shop";

describe("order request lifecycle", () => {
  it("follows the fulfilment path", () => {
    const path = ["SUBMITTED", "CONFIRMED", "FULFILLING", "SHIPPED", "COMPLETED"] as const;
    for (let i = 0; i < path.length - 1; i++) expect(findOrderRule(path[i], path[i + 1]), `${path[i]} → ${path[i + 1]}`).toBeDefined();
  });

  it("lets customers cancel only before confirmation", () => {
    expect(findOrderRule("SUBMITTED", "CANCELLED")?.by).toContain("customer");
    expect(findOrderRule("CONFIRMED", "CANCELLED")?.by).toEqual(["staff"]);
    expect(findOrderRule("FULFILLING", "CANCELLED")).toBeUndefined();
  });

  it("requires reasons for decline and staff cancellation", () => {
    expect(findOrderRule("SUBMITTED", "DECLINED")?.requiresReason).toBe(true);
    expect(findOrderRule("CONFIRMED", "CANCELLED")?.requiresReason).toBe(true);
  });

  it("never skips confirmation or leaves terminal states", () => {
    expect(findOrderRule("SUBMITTED", "FULFILLING")).toBeUndefined();
    expect(findOrderRule("SUBMITTED", "SHIPPED")).toBeUndefined();
    for (const rule of ORDER_RULES) for (const s of TERMINAL_ORDER_STATUSES) expect(rule.from).not.toContain(s);
  });

  it("lists staff actions per status", () => {
    expect(staffTargets("SUBMITTED").sort()).toEqual(["CANCELLED", "CONFIRMED", "DECLINED"]);
    expect(staffTargets("FULFILLING")).toEqual(["SHIPPED"]);
    expect(staffTargets("COMPLETED")).toEqual([]);
  });

  it("maps statuses to tracking steps", () => {
    expect(orderStepIndex("SUBMITTED")).toBe(0);
    expect(orderStepIndex("SHIPPED")).toBe(3);
    expect(orderStepIndex("DECLINED")).toBe(-1);
  });
});

describe("money and stock helpers", () => {
  it("computes subtotals and confirmed totals in paise", () => {
    expect(subtotalOf([{ unitPricePaise: 49900, quantity: 2 }, { unitPricePaise: 29900, quantity: 1 }])).toBe(129700);
    expect(confirmedTotal([{ unitPricePaise: 49900, quantity: 2, confirmedQuantity: 1 }], 9900)).toBe(59800);
  });

  it("shows a discount only when MRP is above price", () => {
    expect(discountPercent(49900, 99900)).toBe(50);
    expect(discountPercent(49900, 49900)).toBeNull();
    expect(discountPercent(49900, null)).toBeNull();
    expect(discountPercent(99900, 49900)).toBeNull();
  });

  it("classifies stock levels", () => {
    expect(stockLevel(0, 5)).toBe("out_of_stock");
    expect(stockLevel(3, 5)).toBe("low_stock");
    expect(stockLevel(5, 5)).toBe("low_stock");
    expect(stockLevel(6, 5)).toBe("in_stock");
    expect(stockLevel(null, 5)).toBe("unknown");
  });
});

describe("shop validation", () => {
  const address = { contactName: "Asha", contactPhone: "98765 43210", addressLine1: "12 MG Road", city: "Pune", state: "Maharashtra", pincode: "411001" };

  it("normalises phones and accepts pan-India addresses", () => {
    const parsed = productRequestSchema.parse(address);
    expect(parsed.contactPhone).toBe("+919876543210");
  });

  it("rejects bad pincodes and unknown states", () => {
    expect(productRequestSchema.safeParse({ ...address, pincode: "011001" }).success).toBe(false);
    expect(productRequestSchema.safeParse({ ...address, state: "Atlantis" }).success).toBe(false);
  });

  it("rejects product slugs that shadow store routes", () => {
    const base = { slug: "cart", sku: "X1", nameEn: "Thing", categoryId: "c", pricePaise: 100, status: "DRAFT" };
    expect(productSchema.safeParse(base).success).toBe(false);
    expect(productSchema.safeParse({ ...base, slug: "good-slug" }).success).toBe(true);
  });
});
