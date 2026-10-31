/**
 * URL slug for a device brand/model name. "+" becomes "plus" so "Galaxy S24+" and "Galaxy S24" never collide;
 * brackets and other punctuation drop out ("Phone (2a)" → "phone-2a").
 */
export function deviceSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

/** "Apple" + "iPhone 16" → "Apple iPhone 16", but "OnePlus" + "OnePlus 12" → "OnePlus 12" (no doubled brand). */
export function deviceName(brand: string, model: string) {
  return model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`;
}
