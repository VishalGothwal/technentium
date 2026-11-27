import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "Design customers" };
export const instant = false;

export default function DesignCustomersPage({ searchParams }: PageProps<"/admin/customization/customers">) {
  return <CustomersList searchParams={searchParams} basePath="/admin/customization/customers" section="customization" title="Design customers" description="Customers with at least one custom design request." />;
}
