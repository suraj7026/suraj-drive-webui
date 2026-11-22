import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/services/auth-service";
import { getPublicApiBaseUrl } from "@/lib/api/core";

export default async function LoginPage() {
  const { user, apiUnavailable } = await getCurrentUser()
    .then((user) => ({ user, apiUnavailable: false }))
    .catch(() => ({ user: null, apiUnavailable: true }));
  if (user) {
    redirect(`/archive/${user.drive_id}`);
  }

  const loginHref = `${getPublicApiBaseUrl()}/api/auth/google/login`;

  return (
    <main className="metro-login">
      <div className="metro-login-brand">suraj drive <span> / </span> your space</div>
      <div className="metro-login-content">
        <p className="metro-login-kicker">your files, in one place</p>
        <h1>make space<br />for what matters.</h1>
        <p className="metro-login-copy">your personal drive for the files, folders and memories you want to keep close.</p>
        {apiUnavailable ? <p className="metro-login-notice" role="status">the drive service is unavailable. sign-in will work when the service is back online.</p> : null}
        <a href={loginHref} className="metro-login-action">continue with google <span aria-hidden="true">→</span></a>
      </div>
      <div className="metro-login-footer">suraj drive <span> / </span> personal cloud storage</div>
    </main>
  );
}
