import { ok } from "@/lib/api";
import { getIntegrations } from "@/lib/integrations";

export async function GET() {
  return ok({
    status: "up",
    app: "corpservices",
    version: "0.1.0-fase01",
    time: new Date().toISOString(),
    integrations: getIntegrations(),
  });
}
