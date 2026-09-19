import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/auth-service";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? `/archive/${user.drive_id}` : "/login");
}
