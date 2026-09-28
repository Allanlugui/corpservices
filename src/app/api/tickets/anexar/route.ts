import { z } from "zod";
import { createAdminClient } from "@/lib/supabase-admin";
import { fail, ok } from "@/lib/api";
import { getSetting } from "@/app/api/configuracoes/route";
import { appendTicketEvent } from "@/lib/audit-append";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILES = 5;

/**
 * Anexos do portal (fotos/documentos na abertura, §3/§4).
 * Capability = tracking_token (mesmo modelo do acompanhamento).
 * Limites: 5 por ticket, imagens/PDF, teto de files_max_mb.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData().catch(() => null);
    const token = String(form?.get("token") ?? "");
    if (!z.string().uuid().safeParse(token).success) return fail("VALIDATION", "Token invalido.", 422);
    const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
    if (files.length === 0) return fail("VALIDATION", "Nenhum arquivo.", 422);
    if (files.length > MAX_FILES) return fail("VALIDATION", `Máximo ${MAX_FILES} por envio.`, 422);
    const admin = createAdminClient();
    const { data: ticket } = await admin.from("tickets").select("id, org_id").eq("tracking_token", token).maybeSingle();
    if (!ticket) return fail("NOT_FOUND", "Solicitacao nao encontrada.", 404);
    const orgId = (ticket as { org_id: string }).org_id;
    const ticketId = (ticket as { id: string }).id;
    const { count } = await admin.from("ticket_attachments").select("id", { count: "exact", head: true }).eq("ticket_id", ticketId);
    if ((count ?? 0) + files.length > MAX_FILES) return fail("LIMIT", `Limite de ${MAX_FILES} anexos por solicitação.`, 422);
    const maxMb = await getSetting(admin, orgId, "files_max_mb");
    const saved: string[] = [];
    for (const file of files) {
      if (!ALLOWED.has(file.type)) return fail("INVALID_TYPE", `Tipo nao permitido: ${file.type || "desconhecido"}.`, 422);
      if (file.size <= 0 || file.size > maxMb * 1024 * 1024) return fail("INVALID_SIZE", `Arquivo maior que ${maxMb}MB.`, 422);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "anexo";
      const path = `${orgId}/ticket/${ticketId}/portal/${crypto.randomUUID()}-${safeName}`;
      const { error: upError } = await admin.storage.from("attachments").upload(path, new Uint8Array(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });
      if (upError) return fail("UPLOAD", "Falha no upload.", 500);
      const { error: dbError } = await admin.from("ticket_attachments").insert({
        ticket_id: ticketId,
        file_path: path,
        mime: file.type,
        size_bytes: file.size,
        uploaded_by: null,
      });
      if (dbError) {
        await admin.storage.from("attachments").remove([path]);
        return fail("DB_INSERT", "Falha ao registrar.", 500);
      }
      saved.push(safeName);
    }
    await appendTicketEvent(admin, ticketId, {
      event: "ANEXO_ADICIONADO",
      detail: { channel: "portal", files: saved },
    });
    return ok({ saved: saved.length }, 201);
  } catch {
    return fail("INTERNAL", "Erro interno.", 500);
  }
}
