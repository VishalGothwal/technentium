import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "All customers" };
export const instant = false;

export default function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  return <CustomersList searchParams={searchParams} basePath="/admin/customers" title="All customers" description="Every customer account, with their bookings, orders and design requests." />;
}
