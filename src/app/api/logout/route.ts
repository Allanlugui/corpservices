import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    try {
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("org_id").eq("id", user.id).single();
      if (profile) {
        await admin.from("audit_events").insert({
          org_id: profile.org_id,
          user_id: user.id,
          event: "LOGOUT",
          detail: { email: user.email },
        });
      }
    } catch {
      // Logout nunca falha por causa da auditoria.
    }
  }
  await supabase.auth.signOut();
  redirect("/login");
}
