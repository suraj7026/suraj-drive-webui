import { SettingsView } from "@/components/shell/settings-view";
import { requireCurrentUser } from "@/lib/services/auth-service";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  return <SettingsView user={user} />;
}
