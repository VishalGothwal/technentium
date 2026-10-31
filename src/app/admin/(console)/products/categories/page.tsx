import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listCategoriesAdmin, listProductTypesAdmin } from "@/server/modules/shop/product-admin.service";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { CategoriesEditor } from "./categories-editor";
import { TypesEditor, type TypeRow } from "./types-editor";

export const metadata = { title: "Product categories & types" };
export const instant = false;

export default async function ProductCategoriesPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "product.manage") && !can(actor, "inventory.manage")) return <NoAccess />;
  const [categories, types] = await Promise.all([listCategoriesAdmin(actor), listProductTypesAdmin(actor)]);
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
        ← Products
      </Link>
      <PageHeader title="Product categories" description="Inactive categories and their products are hidden from the store." />
      <CategoriesEditor
        canEdit={can(actor, "product.manage")}
        categories={categories.map((c) => ({
          id: c.id,
          slug: c.slug,
          nameEn: c.nameEn,
          nameHi: c.nameHi ?? "",
          descriptionEn: c.descriptionEn ?? "",
          descriptionHi: c.descriptionHi ?? "",
          sortOrder: c.sortOrder,
          active: c.active,
          count: c._count.products,
        }))}
      />
      <TypesEditor
        canEdit={can(actor, "product.manage")}
        categories={categories.map((c) => ({ id: c.id, slug: c.slug, nameEn: c.nameEn }))}
        types={types.map((t) => ({
          id: t.id,
          categoryId: t.categoryId,
          categoryName: t.category.nameEn,
          slug: t.slug,
          nameEn: t.nameEn,
          nameHi: t.nameHi ?? "",
          descriptionEn: t.descriptionEn ?? "",
          descriptionHi: t.descriptionHi ?? "",
          highlights: (t.highlights ?? {}) as TypeRow["highlights"],
          imageMediaId: t.imageMediaId,
          sortOrder: t.sortOrder,
          active: t.active,
          count: t._count.products,
        }))}
      />
    </>
  );
}
