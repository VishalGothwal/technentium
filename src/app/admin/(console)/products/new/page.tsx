import Link from "next/link";
import { requireStaffPage } from "@/server/auth/guards";
import { can } from "@/server/rbac/actor";
import { listCategoriesAdmin } from "@/server/modules/shop/product-admin.service";
import { PageHeader } from "@/components/ui/surface";
import { NoAccess } from "@/components/admin/no-access";
import { ProductForm } from "../product-form";

export const metadata = { title: "New product" };
export const instant = false;

export default async function NewProductPage() {
  const actor = await requireStaffPage();
  if (!can(actor, "product.manage")) return <NoAccess />;
  const categories = await listCategoriesAdmin(actor);
  return (
    <>
      <Link href="/admin/products" className="text-sm text-muted hover:text-foreground">
        ← Products
      </Link>
      <PageHeader title="New product" description="Save as draft until images, compatibility and copy are ready. Stock starts at zero." />
      <ProductForm
        categories={categories.filter((c) => c.active)}
        initial={{
          slug: "",
          sku: "",
          nameEn: "",
          nameHi: "",
          summaryEn: "",
          summaryHi: "",
          descriptionEn: "",
          descriptionHi: "",
          categoryId: "",
          typeId: "",
          price: "",
          mrp: "",
          status: "DRAFT",
          featured: false,
          universal: false,
          lowStockThreshold: "5",
          specs: [],
          imageIds: [],
          compat: [],
          seoTitle: "",
          metaDescription: "",
        }}
      />
    </>
  );
}
