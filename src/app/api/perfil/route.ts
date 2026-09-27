import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { AuthError, requireProfile } from "@/lib/require-auth";

/** Perfil próprio: leitura, nome/foto e troca de senha. */
export async function GET() {
  try {
    const session = await requireProfile();
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("display_name, avatar_url, department, position, phone, role_key, must_reset")
      .eq("id", session.userId)
      .single();
    return ok({ profile: { email: session.email, ...(data ?? {}) } });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireProfile();
    const parsed = z.object({ display_name: z.string().trim().max(120) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail("VALIDATION", "Nome invalido.", 422);
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").update({ display_name: parsed.data.display_name }).eq("id", session.userId);
    if (error) return fail("DB_ERROR", "Nao foi possivel salvar.", 500);
    return ok({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}

/** Foto do perfil (png/jpg/webp ≤ 1MB) → bucket público. */
export async function POST(request: Request) {
  try {
    const session = await requireProfile();
    const form = await request.formData().catch(() => null);
    const file = form?.get("image");
    if (!(file instanceof File)) return fail("VALIDATION", "Imagem ausente.", 422);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return fail("FILE_TYPE", "Use PNG, JPG ou WEBP.", 422);
    if (file.size > 1_048_576) return fail("FILE_SIZE", "Máximo 1 MB.", 422);
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `avatares/${session.orgId}/${session.userId}.${ext}`;
    const admin = createAdminClient();
    for (const e of ["png", "jpg", "webp"]) {
      await admin.storage.from("public-assets").remove([`avatares/${session.orgId}/${session.userId}.${e}`]);
    }
    const { error: upErr } = await admin.storage.from("public-assets").upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) return fail("UPLOAD", "Nao foi possivel enviar.", 500);
    const { data } = admin.storage.from("public-assets").getPublicUrl(path);
    await admin.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", session.userId);
    return ok({ avatar_url: data.publicUrl });
  } catch (e) {
    if (e instanceof AuthError) return fail("AUTH", e.message, e.status);
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
