import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { appendAuditEvent } from "@/lib/audit-append";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) {
        await appendAuditEvent(admin, profile.org_id as string, user.id, "LOGOUT", { email: user.email });
      }
    } catch {
      // Logout nunca falha por causa da auditoria.
    }
  }
  await supabase.auth.signOut();
  redirect("/login");
}
