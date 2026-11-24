import { redirect } from "next/navigation";

/** The Devices hub moved to /admin/devices; keep old links working. */
export default function OldDeviceInsightsPage() {
  redirect("/admin/devices");
}
