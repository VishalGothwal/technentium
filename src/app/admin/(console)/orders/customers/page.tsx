import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "Product customers" };
export const instant = false;

export default function ProductCustomersPage({ searchParams }: PageProps<"/admin/orders/customers">) {
  return <CustomersList searchParams={searchParams} basePath="/admin/orders/customers" section="protection" title="Product customers" description="Customers with at least one product order." />;
}
