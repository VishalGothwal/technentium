import { CustomersList } from "@/components/admin/customers-list";

export const metadata = { title: "Repair customers" };
export const instant = false;

export default function RepairCustomersPage({ searchParams }: PageProps<"/admin/bookings/customers">) {
  return <CustomersList searchParams={searchParams} basePath="/admin/bookings/customers" section="repairs" title="Repair customers" description="Customers with at least one repair booking." />;
}
